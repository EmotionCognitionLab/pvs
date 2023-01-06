region = "us-west-2"
env = "prod"

cognito-callback-urls = ["https://heartbeamstudy.org/login/index.html", "http://localhost:8080/login/index.html"]
cognito-logout-url = ["https://heartbeamstudy.org/logout/success"]
cognito-redirect-uri = "https://heartbeamstudy.org/login/index.html"

ses-emailed-reports-bucket = "pvs-prod-lumosity-reports"
datafiles-bucket = "pvs-prod-datafiles"
ds-bucket = "pvs-prod-docusign"
data-bucket = "pvs-prod-usr-data"
