provider "aws" {
    region = var.region
}

# This is set in ../../lambdas/serverless.yml
data "aws_ssm_parameter" "post-confirmation-lambda-arn" {
  name = "/pvs/${var.env}/info/lambdas/write-user-on-verify/arn"
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
    lambda_config {
      post_confirmation = data.aws_ssm_parameter.post-confirmation-lambda-arn.value
    }
}
