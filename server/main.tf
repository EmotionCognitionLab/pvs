provider "aws" {
    region = var.region
}

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
