All of the [AWS Lambda](https://aws.amazon.com/lambda/) functions for the project live here.

## Setup
Do `npm install` . That will install shared modules (mostly ones for testing). Go into each subdirectory (including common-test) and do `npm install` to install the modules used by each function. Make sure that you have [Docker](https://www.docker.com) installed, and then do `docker pull localstack/localstack:latest`. [Localstack](https://github.com/localstack/localstack) is used to run a local version of AWS infrastructure (e.g. S3) for our tests.

## Testing
Once you're all set up, do `docker run --rm -it -p 4566:4566 -p 4571:4571 -e "SERVICES=serverless" localstack/localstack` to fire up localstack. Once it's all up and running, open another terminal and do `npm test`. This should run all of the test suites for all of the individual lambda functions.

## Deployment
Note that you'll need to deploy all of the Terraform resources in the parent directory before you can deploy these lambda functions. Once you have all of the Terraform resources deployed, do `sls deploy`. See the [Serverless documentation](https://www.serverless.com/framework/docs/) for information on how to deploy a single function, rather than all of them at once.