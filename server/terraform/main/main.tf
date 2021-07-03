provider "aws" {
    region = var.region
}

# cognito setup
# do not change this without also changing it
# in ../post-lambdas/cognito.tf
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
    schema {
      attribute_data_type = "String"
      name = "name"
      required = true
      string_attribute_constraints {
          min_length = 1
          max_length = 50
      }
    }
    username_attributes = [ "email" ]
    username_configuration {
      case_sensitive = false
    }
    sms_configuration {
      external_id = "pvs-${var.env}-cognito-snscaller"
      sns_caller_arn = aws_iam_role.cognito-sns.arn
    }
}
output "cognito_pool_id" {
    value = aws_cognito_user_pool.pool.id
}

# save user pool arn to SSM so serverless can reference it
resource "aws_ssm_parameter" "cognito-user-pool-arn" {
  name = "/info/cognito/user-pool/arn"
  description = "Cognito user pool ARN"
  type = "SecureString"
  value = "${aws_cognito_user_pool.pool.arn}"
}

resource "aws_cognito_user_pool_client" "client" {
    name = "client"
    user_pool_id = aws_cognito_user_pool.pool.id
    generate_secret = false
    allowed_oauth_flows = [ "code", "implicit" ]
    allowed_oauth_flows_user_pool_client = true
    allowed_oauth_scopes = [ "openid", "aws.cognito.signin.user.admin" ]
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

resource "aws_cognito_identity_pool" "main" {
  allow_classic_flow               = false
  allow_unauthenticated_identities = false
  identity_pool_name               = "pvs_${var.env}_id_pool"

  cognito_identity_providers {
      client_id               = "${aws_cognito_user_pool_client.client.id}"
      provider_name           = "${aws_cognito_user_pool.pool.endpoint}"
      server_side_token_check = false
  }
}
output "cognito_identity_pool_id" {
  value = aws_cognito_identity_pool.main.id
}

# DynamoDB setup
resource "aws_dynamodb_table" "experiment-data-table" {
  name           = "pvs-${var.env}-experiment-data"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "identityId"
  range_key      = "userDateTimeExperiment"

  attribute {
    name = "identityId"
    type = "S"
  }

  attribute {
    name = "userDateTimeExperiment"
    type = "S"
  }
}

resource "aws_dynamodb_table" "users-table" {
  name           = "pvs-${var.env}-users"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "userId"

  attribute {
    name = "userId"
    type = "S"
  }
}

# save above table name to SSM so serverless can reference it
resource "aws_ssm_parameter" "dynamo-users-table" {
  name = "/info/dynamo/table/users"
  description = "Dynamo table holding user information"
  type = "SecureString"
  value = "${aws_dynamodb_table.users-table.name}"
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

# Policy to allow authenticated cognito users to write
# to the experiment data table, but only rows where
# the hash key is their cognito identity id.
resource "aws_iam_policy" "dynamodb-write-experiment-data" {
  name = "pvs-${var.env}-dynamodb-write-experiment-data"
  path = "/policy/dynamodb/experimentData/write/"
  description = "Allows writing to Dynamodb experiment data table"
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.experiment-data-table.name}"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": [
            "$${cognito-identity.amazonaws.com:sub}"
          ]
        }
      }
    }
  ]
}
POLICY
}

# Policy to allow authenticated cognito users to read
# from the experiment data table, but only rows where
# the hash key is their cognito identity id.
resource "aws_iam_policy" "dynamodb-read-experiment-data" {
  name = "pvs-${var.env}-dynamodb-read-experiment-data"
  path = "/policy/dynamodb/experimentData/read/"
  description = "Allows authenticated users to read their own data from Dynamodb experiment data table"
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.experiment-data-table.name}"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:LeadingKeys": [
            "$${cognito-identity.amazonaws.com:sub}"
          ]
        }
      }
    }
  ]
}
POLICY
}

# policy to allow reading/writing to dynamo
resource "aws_iam_policy" "dynamodb-read-write" {
  name = "pvs-${var.env}-dynamodb-read-write"
  path = "/policy/dynamodb/all/"
  description = "Allows reading from/writing to dynamodb tables"
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:UpdateItem",
        "dynamodb:DescribeTable",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/*"
      ]
    }
  ]
}
POLICY
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

resource "aws_iam_role" "dynamodb-experiment-reader-writer" {
  name = "pvs-${var.env}-dynamo-reader-writer"
  path = "/role/user/dynamodb/readwrite/"
  description = "Allows cognito-auth'd users to read and write their own data from/to experiment data table."
  assume_role_policy    = jsonencode(
      {
          Statement = [
              {
                  Action    = "sts:AssumeRoleWithWebIdentity"
                  Condition = {
                      StringEquals = {
                          "cognito-identity.amazonaws.com:aud" = "${aws_cognito_identity_pool.main.id}"
                      }
                  }
                  Effect    = "Allow"
                  Principal = {
                      Federated = "cognito-identity.amazonaws.com"
                  }
              },
          ]
          Version   = "2012-10-17"
      }
  )
  managed_policy_arns   = [
      aws_iam_policy.dynamodb-write-experiment-data.arn, aws_iam_policy.dynamodb-read-experiment-data.arn
  ]
}

resource "aws_iam_role" "unauthenticated" {
  name = "pvs-${var.env}-cognito-unauthenticated"
  path = "/role/user/unauthenticated/"
  description = "Minimal role for unauthenticated cognito uesrs"
  assume_role_policy    = jsonencode(
      {
          Statement = [
              {
                  Action    = "sts:AssumeRoleWithWebIdentity"
                  Condition = {
                      StringEquals = {
                          "cognito-identity.amazonaws.com:aud" = "${aws_cognito_identity_pool.main.id}"
                      },
                      "ForAnyValue:StringLike" = {
                        "cognito-identity.amazonaws.com:amr" = "unauthenticated"
                      }
                  }
                  Effect    = "Allow"
                  Principal = {
                      Federated = "cognito-identity.amazonaws.com"
                  }
              },
          ]
          Version   = "2012-10-17"
      }
  )

  inline_policy {
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "mobileanalytics:PutEvents",
            "cognito-sync:*"
          ]
          Resource = [
            "*"
          ]
        }
      ]
    })
  }
}

resource "aws_iam_role" "lambda-dynamodb" {
  name = "pvs-${var.env}-lambda-dynamodb"
  path = "/role/lambda/dynamodb/"
  description = "Role for lambda functions needing read/write dynamodb access"
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

  managed_policy_arns   = [
    aws_iam_policy.dynamodb-read-write.arn, aws_iam_policy.cloudwatch-write.arn
  ]
}

# save above IAM role to SSM so serverless can reference it
resource "aws_ssm_parameter" "lambda-dynamodb-role" {
  name = "/role/lambda/dynamodb"
  description = "ARN for lambda role with dynamodb access"
  type = "SecureString"
  value = "${aws_iam_role.lambda-dynamodb.arn}"
}

resource "aws_iam_role" "cognito-sns" {
  name = "pvs-${var.env}-cognito-sns"
  path = "/role/cognito/sns/"
  description = "Role to allow cognito to send messages via SNS"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cognito-idp.amazonaws.com"
        }
        Action =  [
          "sts:AssumeRole"
        ]
        Condition = {
          StringEquals = {
              "sts:ExternalId" = "pvs-${var.env}-cognito-snscaller"
          }
        }
      }
    ]
  })

  inline_policy {
    name = "pvs-${var.env}-sns-publish"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [ "sns:publish" ]
          Resource = [ "*" ]
        }
      ]
    })
  }
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated" = aws_iam_role.dynamodb-experiment-reader-writer.arn
    "unauthenticated" = aws_iam_role.unauthenticated.arn
  }
}
