region = "us-west-2"
env = "prod"

cognito-callback-urls = ["https://www.heartbeamstudy.org/login/index.html", "https://heartbeamstudy.org/login/index.html", "http://localhost:8080/login/index.html"]
cognito-logout-url = ["https://www.heartbeamstudy.org/logout/success", "https://heartbeamstudy.org/logout/success"]
cognito-redirect-uri = "https://www.heartbeamstudy.org/login/index.html"

ses-emailed-reports-bucket = "pvs-prod-lumosity-reports"
datafiles-bucket = "pvs-prod-datafiles"
ds-bucket = "pvs-prod-docusign"
data-bucket = "pvs-prod-usr-data"
