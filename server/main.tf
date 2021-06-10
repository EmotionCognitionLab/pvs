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

# SES setup, including relevant S3 buckets and IAM settings
# bucket for receiving automated report emails from Lumosity
resource "aws_s3_bucket" "ses-bucket" {
  bucket = "${var.ses-emailed-reports-bucket}"
  acl    = "private"
}

# pre-create the "folders" in the bucket so we can 
# lock down access to only those paths
resource "aws_s3_bucket_object" "ses-emails" {
  bucket = aws_s3_bucket.ses-bucket.bucket
  key = "emails/"
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
