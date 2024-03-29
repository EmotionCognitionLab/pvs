This is where all of the AWS resource configuration lives. It is split into two parts: Lambda functions and everything else. The lambda functions are managed using [Serverless](https://serverless.com), and everything else is managed using [Terraform](https://terraform.io).

## Prerequisites
You will need to have an AWS account and have your credentials for it configured correctly. (Your account will need full privileges to create all of the infrastructure.) If you don't have these things, see details for [AWS account creation](https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/) and for [AWS credential configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html).

You will also need to have [Node.js/NPM](https://www.npmjs.com/get-npm), [Terraform](https://learn.hashicorp.com/tutorials/terraform/install-cli) and [Docker](https://www.docker.com) installed.

## Setup
In the `lambdas`, `lambdas/common-test`, `lambdas/on-user-verify` and `lambdas/process-lumosity-emails` directories, do `npm install`.

In the terraform/main and terraform/post-lambdas directories, do:
```
terraform init
terraform workspace new dev
```
You can replace 'dev' with whatever workspace name you prefer.

Do `docker pull localstack/localstack:latest`.

### better-sqlite3 lambda layer setup
Do the following:
```
cd lambdas/better-sqlite-3-layer
docker build -t lambda-docker:14.x .
chmod +x build.sh
./build.sh
```


## Testing
Do `docker run --rm -it -p 4566:4566 -p 4571:4571 -e "SERVICES=serverless" localstack/localstack`. Once it's up and running, open another terminal window and do:

```
cd lambdas
npm test
```

## Deployment
The following steps must be done in order.

1.
```
cd terraform/main
terraform apply -var-file=dev.tfvars
cd ../..
```
2.
```
cd lambdas
sls deploy
cd ..
```
The 'sls deploy' should spit out (among many other things) a couple of lines that look like this:
```
layers:
  BetterSqlite3: arn:aws:lambda:us-west-2:1234567890:layer:BetterSqlite3:4
```
Copy the part after "layer:" and edit lambdas/serverless.yml, setting the layer name and version in the "layers" section of the process-sqlite-dbs function.
3.
```
cd terraform/post-lambdas
terraform apply -var-file=dev.tfvars
cd ../..
```
4.
```
cd lambdas
sls deploy
cd ..
```
