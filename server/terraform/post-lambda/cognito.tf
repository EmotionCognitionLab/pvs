terraform {
  backend "s3" {
    bucket = "pvs-tf-state"
    region = "us-west-2"
    key = "cognito"
    workspace_key_prefix = "workspaces"
  }
}

provider "aws" {
    region = var.region
}

# These are set in ../../lambdas/serverless.yml
data "aws_ssm_parameter" "post-confirmation-lambda-arn" {
  name = "/pvs/${var.env}/info/lambdas/write-user-on-verify/arn"
}

data "aws_ssm_parameter" "pre-signup-lambda-arn" {
  name = "/pvs/${var.env}/info/lambdas/confirm-signed-consent-on-signup/arn"
}

# do not change this without also changing it
# in ../main/main.tf
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
    lambda_config {
      pre_sign_up = data.aws_ssm_parameter.pre-signup-lambda-arn.value
      post_confirmation = data.aws_ssm_parameter.post-confirmation-lambda-arn.value
    }
}
