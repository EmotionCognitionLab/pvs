import { CognitoIdentityProvider } from '@aws-sdk/client-cognito-identity-provider'
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument} from "@aws-sdk/lib-dynamodb";
import { SES } from '@aws-sdk/client-ses'

// too bad we have to do this, but db.js expects the v2 dynamodb document client
const AWS = require('aws-sdk');

const region = process.env.REGION;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const sesEndpoint = process.env.SES_ENDPOINT;

const dynamoDocClient = new AWS.DynamoDB.DocumentClient({
    endpoint: dynamoEndpoint,
    apiVersion: "2012-08-10",
    region: region,
});

const sesClient = new SES({endpoint: sesEndpoint, region: region});

const cognitoClient = new CognitoIdentityProvider({ region: region });

export { dynamoDocClient, sesClient, cognitoClient }