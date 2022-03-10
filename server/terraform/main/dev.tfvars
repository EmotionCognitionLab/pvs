region = "us-west-2"
env = "dev"

cognito-callback-urls = ["https://dev.heartbeamstudy.org/login/index.html", "http://localhost:9000/login/index.html"]
cognito-logout-url = ["https://dev.heartbeamstudy.org/logout/success", "http://localhost:9000/logout/success"]
cognito-redirect-uri = "https://dev.heartbeamstudy.org/login/index.html"

ses-emailed-reports-bucket = "pvs-dev-lumosity-reports"
datafiles-bucket = "pvs-dev-datafiles"
ds-bucket = "pvs-dev-docusign"
