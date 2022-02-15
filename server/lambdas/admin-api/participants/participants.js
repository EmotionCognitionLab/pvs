import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand} from "@aws-sdk/lib-dynamodb";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import Db from 'db/db.js';

const AWS = require("aws-sdk");
const region = process.env.REGION;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

const noAccess = {
    statusCode: 401,
    body: "You do not have permission to access this information"
};

exports.getAll = async(event) => {
    const userRole = event.requestContext.authorizer.jwt.claims['cognito:preferred_role'];
    if (!userRole) return noAccess;

    const credentials = await credentialsForRole(userRole)
    const dbClient = new DynamoDBClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region, credentials: credentials });
    const docClient = DynamoDBDocumentClient.from(dbClient);

    return await getAllParticipants(docClient);
}

exports.getSets = async(event) => {
    const userRole = event.requestContext.authorizer.jwt.claims['cognito:preferred_role'];
    if (!userRole) return noAccess;
    
    const credentials = await credentialsForRole(userRole);
    const db = dbWithCredentials(credentials);

    const participantId = event.pathParameters.id;
    return await db.getSetsForUser(participantId);
}

exports.update = async(event) => {
    const userRole = event.requestContext.authorizer.jwt.claims['cognito:preferred_role'];
    if (!userRole) return noAccess;
    
    const credentials = await credentialsForRole(userRole);
    const db = dbWithCredentials(credentials);

    const participantId = event.pathParameters.id;
    const properties = JSON.parse(event.body);
    return await db.updateUser(participantId, properties);
}

exports.get = async(event) => {
    const userRole = event.requestContext.authorizer.jwt.claims['cognito:preferred_role'];
    if (!userRole) return noAccess;
    
    const credentials = await credentialsForRole(userRole);
    const db = dbWithCredentials(credentials);

    const participantId = event.pathParameters.id;
    const consistentRead = event.queryStringParameters && event.queryStringParameters.consistentRead === 'true';
    const user = await db.getUser(participantId, consistentRead);
    if (Object.keys(user).length === 0) {
        return {
            statusCode: 404,
            body: `User ${participantId} not found`
        }
    }
    
    return user;
}

async function credentialsForRole(roleArn) {
    const assumeRoleCmd = new AssumeRoleCommand({RoleArn: roleArn, RoleSessionName: "lambdaCognitoUser"});
    const stsClient = new STSClient({ region: region });
    const roleData = await stsClient.send(assumeRoleCmd);
    return {
        accessKeyId: roleData.Credentials.AccessKeyId,
        secretAccessKey: roleData.Credentials.SecretAccessKey,
        sessionToken: roleData.Credentials.SessionToken
    };
}

async function getAllParticipants(docClient) {
    try {
        const params = {
            TableName: usersTable,
            FilterExpression: 'attribute_not_exists(isStaff) or isStaff = :f',
            ExpressionAttributeValues: { ':f': false }
        };
        const scan = new ScanCommand(params);
        const dynResults = await docClient.send(scan);
        return dynResults.Items;
        
    } catch (err) {
        console.error(err);
        throw err;
    }
}

function dbWithCredentials(credentials) {
    const docClient = new AWS.DynamoDB.DocumentClient({
        endpoint: dynamoEndpoint,
        apiVersion: "2012-08-10",
        region: region,
        credentials: credentials
    });

    const db = new Db();
    db.docClient = docClient;
    db.credentials = credentials;
    return db;
}