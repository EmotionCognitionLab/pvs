terraform {
  backend "s3" {
    bucket = "pvs-tf-state"
    region = "us-west-2"
    key = "main"
    workspace_key_prefix = "workspaces"
  }
}

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
      mutable = true
      string_attribute_constraints {
          min_length = 12
          max_length = 12
      }
    }
    schema {
      attribute_data_type = "String"
      name = "name"
      required = true
      mutable = true
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
  name = "/pvs/${var.env}/info/cognito/user-pool/arn"
  description = "Cognito user pool ARN"
  type = "SecureString"
  value = "${aws_cognito_user_pool.pool.arn}"
}

# save user pool id to SSM so serverless can reference it
resource "aws_ssm_parameter" "cognito-user-pool-id" {
  name = "/pvs/${var.env}/info/cognito/user-pool/id"
  description = "Cognito user pool id"
  type = "SecureString"
  value = "${aws_cognito_user_pool.pool.id}"
}

resource "aws_cognito_user_pool_client" "client" {
    name = "client"
    user_pool_id = aws_cognito_user_pool.pool.id
    generate_secret = false
    allowed_oauth_flows = [ "code", "implicit" ]
    allowed_oauth_flows_user_pool_client = true
    allowed_oauth_scopes = [ "openid", "aws.cognito.signin.user.admin" ]
    callback_urls = "${var.cognito-callback-urls}"
    default_redirect_uri = "${var.cognito-redirect-uri}"
    logout_urls = "${var.cognito-logout-url}"
    supported_identity_providers = [ "COGNITO" ]
    read_attributes = ["email", "name", "phone_number", "phone_number_verified", "email_verified"]
    write_attributes = ["email", "name", "phone_number"]
}
output "cognito_pool_client_id" {
    value = aws_cognito_user_pool_client.client.id
}

# save user pool client id to SSM so serverless can reference it
resource "aws_ssm_parameter" "cognito-user-pool-client-id" {
  name = "/pvs/${var.env}/info/cognito/user-pool/client/id"
  description = "Cognito user pool client id"
  type = "SecureString"
  value = "${aws_cognito_user_pool_client.client.id}"
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

resource "aws_cognito_user_group" "admin" {
  name = "admin"
  user_pool_id = aws_cognito_user_pool.pool.id
  description = "User group for study administrators"
  precedence = 1
  role_arn = aws_iam_role.study-admin.arn
}

resource "aws_cognito_user_group" "researcher" {
  name = "researcher"
  user_pool_id = aws_cognito_user_pool.pool.id
  description = "User group for study researchers"
  precedence = 10
  role_arn = aws_iam_role.researcher.arn
}

# DynamoDB setup
resource "aws_dynamodb_table" "experiment-data-table" {
  name           = "pvs-${var.env}-experiment-data"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "identityId"
  range_key      = "experimentDateTime"

  attribute {
    name = "identityId"
    type = "S"
  }

  attribute {
    name = "experimentDateTime"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name = "userId-experimentDateTime-index"
    hash_key = "userId"
    range_key = "experimentDateTime"
    projection_type = "INCLUDE"
    non_key_attributes = ["identityId"]
  }
}

# save above table name to SSM so serverless can reference it
resource "aws_ssm_parameter" "dynamo-experiment-data-table" {
  name = "/pvs/${var.env}/info/dynamo/table/experiments"
  description = "Dynamo table holding experiment data"
  type = "SecureString"
  value = "${aws_dynamodb_table.experiment-data-table.name}"
}

resource "aws_dynamodb_table" "daily-regimes-table" {
  name           = "pvs-${var.env}-daily-regimes"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "identityId"
  range_key      = "date"

  attribute {
    name = "identityId"
    type = "S"
  }

  attribute {
    name = "date"
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
  name = "/pvs/${var.env}/info/dynamo/table/users"
  description = "Dynamo table holding user information"
  type = "SecureString"
  value = "${aws_dynamodb_table.users-table.name}"
}

resource "aws_dynamodb_table" "consent-table" {
  name           = "pvs-${var.env}-consent"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "envelopeId"

  attribute {
    name = "envelopeId"
    type = "S"
  }
}

# save above table name to SSM so serverless can reference it
resource "aws_ssm_parameter" "dynamo-consent-table" {
  name = "/pvs/${var.env}/info/dynamo/table/consent"
  description = "Dynamo table holding user consent details"
  type = "SecureString"
  value = "${aws_dynamodb_table.consent-table.name}"
}

resource "aws_dynamodb_table" "ds-table" {
  name           = "pvs-${var.env}-ds"
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
resource "aws_ssm_parameter" "dynamo-ds-table" {
  name = "/pvs/${var.env}/info/dynamo/table/ds"
  description = "Dynamo table holding user docusign details"
  type = "SecureString"
  value = "${aws_dynamodb_table.ds-table.name}"
}

resource "aws_dynamodb_table" "lumos-acct-table" {
  name           = "pvs-${var.env}-lumos-acct"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "email"

  attribute {
    name = "email"
    type = "S"
  }
}

# save above table name to SSM so serverless can reference it
resource "aws_ssm_parameter" "lumos-acct-table" {
  name = "/pvs/${var.env}/info/dynamo/table/lumosacct"
  description = "Dynamo table holding lumosity account info"
  type = "SecureString"
  value = "${aws_dynamodb_table.lumos-acct-table.name}"
}

# SES setup, including relevant S3 buckets and IAM settings
# bucket for receiving automated report emails from Lumosity
resource "aws_s3_bucket" "ses-bucket" {
  bucket = "${var.ses-emailed-reports-bucket}"
  acl    = "private"
}

# save above bucket name to SSM so serverless can reference it
resource "aws_ssm_parameter" "lambda-ses-bucket" {
  name = "/pvs/${var.env}/info/lambda/ses/bucket"
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
  name = "/pvs/${var.env}/info/lambda/ses/prefix"
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
  rule_set_name = "pvs-${var.env}-ses-rules"
}

resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = "pvs-${var.env}-ses-rules"
  depends_on = [aws_ses_receipt_rule_set.main]
}

resource "aws_ses_receipt_rule" "save-to-s3" {
  name          = "save-to-s3"
  rule_set_name = "pvs-${var.env}-ses-rules"
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

# S3 bucket for temporary storage of downloadable research results
resource "aws_s3_bucket" "datafiles-bucket" {
  bucket = "${var.datafiles-bucket}"
  acl    = "private"
  lifecycle_rule {
    enabled = true
    expiration {
      days = 7
    }
  }
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["https://dev.heartbeamstudy.org", "http://localhost:9000", "https://www.heartbeamstudy.org", "https://heartbeamstudy.org"]
  }
}

# save above bucket name to SSM so serverless can reference it
resource "aws_ssm_parameter" "datafiles-bucket" {
  name = "/pvs/${var.env}/info/lambda/datafiles/bucket"
  description = "Bucket for temporary storage of downloadable research results"
  type = "SecureString"
  value = "${aws_s3_bucket.datafiles-bucket.bucket}"
}

# S3 bucket for docusign
resource "aws_s3_bucket" "ds-bucket" {
  bucket = "${var.ds-bucket}"
  acl = "private"
}

# save above bucket name to SSM so serverless can reference it
resource "aws_ssm_parameter" "ds-bucket" {
  name = "/pvs/${var.env}/info/lambda/ds/bucket"
  description = "Bucket for files related to Docusign"
  type = "SecureString"
  value = "${aws_s3_bucket.ds-bucket.bucket}"
}

# S3 bucket for participant data
resource "aws_s3_bucket" "data-bucket" {
  bucket = "${var.data-bucket}"
  versioning {
    enabled = true
  }
  acl = "private"
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

# Policy to allow authenticated users to write data to
# their own folder
resource "aws_iam_policy" "s3-write-experiment-data" {
  name = "pvs-${var.env}-s3-write-experiement-data"
  path = "/policy/s3/experimentData/write/"
  description = "Allows writing data to participant's own s3 folder"
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject"
      ],
      "Resource": [
        "arn:aws:s3:::${var.data-bucket}/*/$${cognito-identity.amazonaws.com:sub}",
        "arn:aws:s3:::${var.data-bucket}/*/$${cognito-identity.amazonaws.com:sub}/*"
      ]
    }
  ]
}
POLICY
}

# Policy to allow authenticated users to read data from
# their own folder
resource "aws_iam_policy" "s3-read-experiment-data" {
  name = "pvs-${var.env}-s3-read-experiment-data"
  path = "/policy/s3/experimentData/read/"
  description = "Allows writing data to participant's own s3 folder"
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::${var.data-bucket}/*/$${cognito-identity.amazonaws.com:sub}",
        "arn:aws:s3:::${var.data-bucket}/*/$${cognito-identity.amazonaws.com:sub}/*"
      ]
    }
  ]
}
POLICY
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

# Policy to allow authenticated cognito users to read/write
# from/to the daily regimes table, but only rows where
# the hash key is their cognito identity id.
resource "aws_iam_policy" "dynamodb-read-write-daily-regimes" {
  name = "pvs-${var.env}-dynamodb-read-write-daily-regimes"
  path = "/policy/dynamodb/regimes/readwrite/"
  description = "Allows authenticated users to read/write their own data from/to dynamodb daily regimes table"
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:DescribeTable",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem",
        "dynamodb:PutItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.daily-regimes-table.name}"
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

# policy to allow limited reading/writing of dynamo user table
resource "aws_iam_policy" "dynamodb-user-read-write" {
  name = "pvs-${var.env}-dynamodb-user-read-write"
  path = "/policy/dynamodb/users/all/"
  description = "Allows limited reading from/writing to dynamodb user table"
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:UpdateItem",
        "dynamodb:DescribeTable",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:PutItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.users-table.name}"
      ]
    }
  ]
}
POLICY
}

# policy to allow limited reading/writing of dynamo lumosity account table
resource "aws_iam_policy" "dynamodb-lumos-acct-read-write" {
  name = "pvs-${var.env}-dynamodb-lumos-acct-read-write"
  path = "/policy/dynamodb/lumos/all/"
  description = "Allows limited reading from/writing of dynamodb lumosity account table"
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:UpdateItem",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.lumos-acct-table.name}"
      ]
    }
  ]
}
POLICY
}

# policy to allow fetching user ids from dynamo user table
# TODO remove this after refactoring experiment data table to allow query by experiment name
resource "aws_iam_policy" "dynamodb-userid-read" {
  name = "pvs-${var.env}-dynamodb-userid-read"
  path = "/policy/dynamodb/users/ids/"
  description = "Allows very limited reading from dynamodb user table"
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.users-table.name}"
      ],
      "Condition": {
        "ForAllValues:StringEquals": {
          "dynamodb:Attributes": [
            "userId"
          ]
        },
        "StringEqualsIfExists": {
          "dynamodb:Select": "SPECIFIC_ATTRIBUTES"
        }
      }
    }
  ]
}
POLICY
}

# Policy to allow reading from the experiment data table
resource "aws_iam_policy" "dynamodb-read-all-experiment-data" {
  name = "pvs-${var.env}-dynamodb-read-all-experiment-data"
  path = "/policy/dynamodb/experimentData/readAll/"
  description = "Allows reading all data from Dynamodb experiment data table"
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
        "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.experiment-data-table.name}",
        "arn:aws:dynamodb:${var.region}:${data.aws_caller_identity.current.account_id}:table/${aws_dynamodb_table.experiment-data-table.name}/index/*"
      ]
    }
  ]
}
POLICY
}

# policy to allow sns publishing
resource "aws_iam_policy" "sns-publish" {
  name = "pvs-${var.env}-sns-publish"
  path = "/policy/sns/publish/"
  description = "Allows SNS publishing"
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

# policy to allow email send via SES
resource "aws_iam_policy" "ses-send" {
  name = "pvs-${var.env}-ses-send"
  path = "/policy/ses/send/"
  description = "Allows emails sends via SES"
  policy = jsonencode({
    Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [ "ses:SendEmail", "ses:SendRawEmail" ]
          Resource = [ "*" ]
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
  name = "/pvs/${var.env}/role/lambda/ses/process"
  description = "ARN for lambda role to process emails received from SES"
  type = "SecureString"
  value = "${aws_iam_role.lambda-ses-process.arn}"
}

resource "aws_iam_role" "dynamodb-experiment-reader-writer" {
  name = "pvs-${var.env}-dynamo-reader-writer"
  path = "/role/user/dynamodb/readwrite/"
  description = "Allows cognito-auth'd users to read and write their own data from/to certain dynamo tables and s3 buckets."
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
      aws_iam_policy.dynamodb-write-experiment-data.arn,
      aws_iam_policy.dynamodb-read-experiment-data.arn,
      aws_iam_policy.dynamodb-read-write-daily-regimes.arn,
      aws_iam_policy.s3-write-experiment-data.arn,
      aws_iam_policy.s3-read-experiment-data.arn
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

resource "aws_iam_role" "lambda" {
  name = "pvs-${var.env}-lambda"
  path = "/role/lambda/"
  description = "Basic role for running lambda functions"
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
    aws_iam_policy.dynamodb-user-read-write.arn,
    aws_iam_policy.dynamodb-lumos-acct-read-write.arn,
    aws_iam_policy.dynamodb-read-all-experiment-data.arn,
    aws_iam_policy.cloudwatch-write.arn
  ]
}

# save above IAM role to SSM so serverless can reference it
resource "aws_ssm_parameter" "lambda-role" {
  name = "/pvs/${var.env}/role/lambda"
  description = "ARN for lambda role"
  type = "SecureString"
  value = "${aws_iam_role.lambda.arn}"
}

resource "aws_iam_role_policy" "lambda-role-assumption" {
  name = "pvs-${var.env}-lambda-role-assumption-policy"
  role = aws_iam_role.lambda.name
  policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "sts:AssumeRole"
          ]
          Resource = [
            "${aws_iam_role.researcher.arn}",
            "${aws_iam_role.study-admin.arn}"
          ]
        }
      ]
    })
}

resource "aws_iam_role" "study-admin" {
  name = "pvs-${var.env}-study-admin"
  path = "/role/admin/"
  description = "Role for study administrators"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "${aws_iam_role.lambda.arn}"
          Service = "lambda.amazonaws.com"
        }
        Action =  [
          "sts:AssumeRole"
        ]
      },
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = [
          "sts:AssumeRoleWithWebIdentity"
        ]
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = "${aws_cognito_identity_pool.main.id}"
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr": "authenticated"
          }
        }
      }
    ]
  })

  inline_policy {
    name = "pvs-${var.env}-ds-bucket-read"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
          Effect = "Allow"
          Action = [
            "s3:GetObject"
          ]
          Resource = [
            "${aws_s3_bucket.ds-bucket.arn}/*"
          ]
        }
      ]
    })
  }

  managed_policy_arns   = [
    aws_iam_policy.dynamodb-read-write.arn, aws_iam_policy.cloudwatch-write.arn
  ]
}

resource "aws_iam_role" "researcher" {
  name = "pvs-${var.env}-researcher"
  path = "/role/lambda/dynamodb/experimentData/read/"
  description = "Role for lambda functions needing read access to experiment data"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "${aws_iam_role.lambda.arn}"
        }
        Action =  [
          "sts:AssumeRole"
        ]
      },
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = [
          "sts:AssumeRoleWithWebIdentity"
        ]
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = "${aws_cognito_identity_pool.main.id}"
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr": "authenticated"
          }
        }
      }
    ]
  })
  inline_policy {
    name = "datafiles-bucket-access"
    policy = jsonencode({
      Version = "2012-10-17"
      Statement = [
        {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
        ],
        Resource = "${aws_s3_bucket.datafiles-bucket.arn}/*"
      }
      ]
    })
  }

  managed_policy_arns   = [
    aws_iam_policy.dynamodb-read-all-experiment-data.arn,
    aws_iam_policy.cloudwatch-write.arn,
    aws_iam_policy.dynamodb-userid-read.arn
  ]
}

resource "aws_iam_role" "lambda-dynamodb-sns-ses" {
  name = "pvs-${var.env}-lambda-dynamodb-sns-ses"
  path = "/role/lambda/dynamodb/sns/ses/"
  description = "Role for lambda functions needing dynamo, sns and ses access"
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
    aws_iam_policy.dynamodb-read-write.arn,
    aws_iam_policy.sns-publish.arn,
    aws_iam_policy.ses-send.arn,
    aws_iam_policy.cloudwatch-write.arn
  ]
}

# save above IAM role to SSM so serverless can reference it
resource "aws_ssm_parameter" "lambda-dynamodb-sns-ses-role" {
  name = "/pvs/${var.env}/role/lambda/dynamodb/sns/ses"
  description = "ARN for lambda role with dynamodb, sns and ses access"
  type = "SecureString"
  value = "${aws_iam_role.lambda-dynamodb-sns-ses.arn}"
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

  managed_policy_arns = [aws_iam_policy.sns-publish.arn]
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "authenticated" = aws_iam_role.dynamodb-experiment-reader-writer.arn
    "unauthenticated" = aws_iam_role.unauthenticated.arn
  }
}

# resources for writing console logs to Cloudwatch
resource "aws_iam_user" "console-log-writer" {
  name = "pvs-${var.env}-console-log-writer"
}

resource "aws_cloudwatch_log_group" "console-log-group" {
  name = "pvs-${var.env}-console"
  retention_in_days = 30
}

resource "aws_iam_policy" "console-log-write" {
  name = "pvs-${var.env}-cloudwatch-console-write"
  path = "/policy/cloudwatch/console/"
  description = "Allows writing to specific CloudWatch log group"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = [ "${aws_cloudwatch_log_group.console-log-group.arn}:*:*" ]
      }
    ]
  })
}

resource "aws_iam_user_policy_attachment" "console-log-writer-policy" {
  user = aws_iam_user.console-log-writer.name
  policy_arn = aws_iam_policy.console-log-write.arn
}


resource "aws_iam_access_key" "console-log-writer-key" {
  user = aws_iam_user.console-log-writer.name
}

output "console_log_writer_id" {
  value = aws_iam_access_key.console-log-writer-key.id
}

resource "aws_cloudwatch_log_metric_filter" "console-error" {
  name = "pvs-${var.env}-console-error"
  pattern = "error"
  log_group_name = aws_cloudwatch_log_group.console-log-group.name

  metric_transformation {
    name = "pvs-${var.env}-console-error-count"
    namespace = "LogMetrics"
    value = "1"
  }
}

# provisioner is used b/c trying to set up an email
# subscription to an sns topic via aws_sns_topic_subscription
# fails with:
# error creating SNS topic subscription: InvalidParameter: Invalid parameter: Email address
# provisioner will only run when the topic is first created
# and will *not* update the subscriptions when var.console-error-notification-emails
# is changed
# https://medium.com/@raghuram.arumalla153/aws-sns-topic-subscription-with-email-protocol-using-terraform-ed05f4f19b73
# https://github.com/rarumalla1/terraform-projects/tree/master/aws-sns-email-subscription-terraform-using-command
resource "aws_sns_topic" "console-errors" {
  name = "pvs-${var.env}-console-errors-topic"
  provisioner "local-exec" {
    command = "/usr/bin/env bash sns-subscription.sh"
    environment = {
      sns_arn = self.arn
      sns_emails = var.console-error-notification-emails
     }
  }
}

resource "aws_cloudwatch_metric_alarm" "console-error-alarm" {
  alarm_name = "pvs-${var.env}-console-error-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods = 1
  period = 300
  metric_name = "pvs-${var.env}-console-error-count"
  namespace = "LogMetrics"
  statistic = "Sum"
  threshold = 0
  alarm_actions = [aws_sns_topic.console-errors.arn]
  datapoints_to_alarm = 1
  treat_missing_data = "notBreaching"
}