provider "aws" {
    region = var.region
}

# cognito setup
resource "aws_cognito_user_pool" "pool" {
    name = "pvs-${var.env}-users"
    auto_verified_attributes = [ "email" ]
    password_policy {
      minimum_length = 12
    }
    account_recovery_setting {
      recovery_mechanism {
        name = "verified_email"
        priority = 1
      }
    }
    schema {
      attribute_data_type = "String"
      name = "phone_number"
      required = true
      string_attribute_constraints {
          min_length = 12
          max_length = 12
      }
    }
    username_attributes = [ "email" ]
    username_configuration {
      case_sensitive = false
    }
}
output "cognito_pool_id" {
    value = aws_cognito_user_pool.pool.id
}

resource "aws_cognito_user_pool_client" "client" {
    name = "client"
    user_pool_id = aws_cognito_user_pool.pool.id
    generate_secret = false
    allowed_oauth_flows = [ "code", "implicit" ]
    allowed_oauth_flows_user_pool_client = true
    allowed_oauth_scopes = [ "openid" ]
    callback_urls = [ "${var.cognito-callback-url}" ]
    default_redirect_uri = "${var.cognito-redirect-uri}"
    logout_urls = [ "${var.cognito-logout-url}" ]
    supported_identity_providers = [ "COGNITO" ]
}
output "cognito_pool_client_id" {
    value = aws_cognito_user_pool_client.client.id
}

resource "aws_cognito_user_pool_domain" "main" {
    domain = "pvs-${var.env}"
    user_pool_id = aws_cognito_user_pool.pool.id
}

# DynamoDB setup
resource "aws_dynamodb_table" "experiment-data-table" {
  name           = "pvs-${var.env}-experiment-data"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "userId"
  range_key      = "experimentDateTime"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "experimentDateTime"
    type = "S"
  }
}


# SES setup, including relevant S3 buckets and IAM settings
# bucket for receiving automated report emails from Lumosity
resource "aws_s3_bucket" "ses-bucket" {
  bucket = "${var.ses-emailed-reports-bucket}"
  acl    = "private"
}

# save above bucket name to SSM so serverless can reference it
resource "aws_ssm_parameter" "lambda-ses-bucket" {
  name = "/info/lambda/ses/bucket"
  description = "Bucket from which lambda should process emails received from SES"
  type = "SecureString"
  value = "${aws_s3_bucket.ses-bucket.bucket}"
}

# pre-create the "folders" in the bucket so we can 
# lock down access to only those paths
resource "aws_s3_bucket_object" "ses-emails" {
  bucket = aws_s3_bucket.ses-bucket.bucket
  key = "emails/"
}

# save above prefix to SSM so serverless can reference it
resource "aws_ssm_parameter" "lambda-ses-prefix" {
  name = "/info/lambda/ses/prefix"
  description = "Bucket from which lambda should process emails received from SES"
  type = "SecureString"
  value = "${aws_s3_bucket_object.ses-emails.key}"
}

resource "aws_s3_bucket_object" "ses-reports" {
  bucket = aws_s3_bucket.ses-bucket.bucket
  key = "reports/"
}

# iam policy to allow SES to save email to s3 bucket
data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_policy" "receive" {
  bucket = aws_s3_bucket.ses-bucket.id
  policy = jsonencode(
  {
    Version = "2012-10-17",
    Id = "ses-to-s3-policy",
    Statement = [
    {
        Sid = "AllowSESPuts",
        Effect = "Allow",
        Principal = {
          Service = "ses.amazonaws.com"
        },
        Action = "s3:PutObject",
        Resource = [
          aws_s3_bucket.ses-bucket.arn,
          "${aws_s3_bucket.ses-bucket.arn}/*"
        ]
        Condition = {
          StringEquals = {
            "aws:Referer" = "${data.aws_caller_identity.current.account_id}"
          }
        }
    }
    ]
  }
  )
}

# SES rules to write email to bucket
resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "ses-rules"
}

resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = "ses-rules"
}

resource "aws_ses_receipt_rule" "save-to-s3" {
  name          = "save-to-s3"
  rule_set_name = "ses-rules"
  recipients    = ["lumosityreports@heartbeamstudy.org"]
  enabled       = true
  scan_enabled  = true

  s3_action {
    bucket_name = "${var.ses-emailed-reports-bucket}"
    object_key_prefix = "emails"
    position    = 1
  }

  depends_on = [aws_s3_bucket_policy.receive]
}

# IAM policies
resource "aws_iam_policy" "cloudwatch-write" {
  name = "pvs-${var.env}-cloudwatch-write"
  path = "/policy/cloudwatch/"
  description = "Allows writing to CloudWatch logs"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# IAM roles
resource "aws_iam_role" "lambda-ses-process" {
  name = "pvs-${var.env}-lambda-ses-process"
  path = "/role/lambda/ses/process/"
  description = "Role for lambda function(s) handling receipt of emails in SES bucket"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action =  [
          "sts:AssumeRole"
        ]
      }
    ]
  })

  inline_policy {
    name = "pvs-${var.env}-ses-bucket-write"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "s3:PutObject",
            "s3:PutObjectAcl"
          ]
          Resource = [
            "${aws_s3_bucket.ses-bucket.arn}/reports/*"
          ]
        },
        {
          Effect = "Allow"
          Action = [
            "s3:GetObject"
          ]
          Resource = [
            "${aws_s3_bucket.ses-bucket.arn}/emails/*"
          ]
        }
      ]
    })
  }

  managed_policy_arns = [aws_iam_policy.cloudwatch-write.arn]
}

# save above IAM role to SSM so serverless can reference it
resource "aws_ssm_parameter" "lambda-ses-role" {
  name = "/role/lambda/ses/process"
  description = "ARN for lambda role to process emails received from SES"
  type = "SecureString"
  value = "${aws_iam_role.lambda-ses-process.arn}"
}
