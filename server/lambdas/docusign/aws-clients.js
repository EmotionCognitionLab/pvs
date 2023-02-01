import { SQS } from "@aws-sdk/client-sqs"

const AWS = require("aws-sdk");

const region = process.env.REGION;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

const docClient = new AWS.DynamoDB.DocumentClient({
    endpoint: dynamoEndpoint,
    apiVersion: "2012-08-10",
    region: region,
});

const sqsClient = new SQS({region: region});

export { docClient, sqsClient }