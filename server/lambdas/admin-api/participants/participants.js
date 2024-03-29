import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand} from "@aws-sdk/lib-dynamodb";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import Db from 'db/db.js';
import awsSettings from "../../../../common/aws-settings.json";
import { baselineStatus, stage2Status, stage3Status } from "./status.js";

const AWS = require("aws-sdk");
const region = process.env.REGION;
const usersTable = process.env.USERS_TABLE;
const potentialParticipantsTable = process.env.POTENTIAL_PARTICIPANTS_TABLE;
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

exports.getEarnings = async(event) => {
    const userRole = event.requestContext.authorizer.jwt.claims['cognito:preferred_role'];
    if (!userRole) return noAccess;
    
    const credentials = await credentialsForRole(userRole);
    const db = dbWithCredentials(credentials);

    const participantId = event.pathParameters.id;
    const earningsType = event.pathParameters.earningsType;
    return await db.earningsForUser(participantId, earningsType);
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

exports.getPotential = async(event) => {
    const userRole = event.requestContext.authorizer.jwt.claims['cognito:preferred_role'];
    if (!userRole.endsWith(awsSettings.AdminRole)) return noAccess;

    try {
        const params = {
            TableName: potentialParticipantsTable
        };
        const scan = new ScanCommand(params);
        const credentials = await credentialsForRole(userRole)
        const dbClient = new DynamoDBClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region, credentials: credentials });
        const docClient = DynamoDBDocumentClient.from(dbClient);
        const dynResults = await docClient.send(scan);
        return dynResults.Items.sort((i, j) => i.date < j.date ? -1 : i.date > j.date ? 1 : 0);
        
    } catch (err) {
        console.error(err);
        throw err;
    }

}

/**
 * Status is red, yellow, green or gray as follows:
 * green: Participant has done everything they're supposed to for 4-5 days out of the last 5,
 * or is in the first 1-2 days of what they're supposed to be doing.
 * yellow: Participant has done everything they're supposed to for 2-3 days out of the last 5,
 * or is in the first 3-4 days of what they're supposed to be doing and has done everything they should for <2 days.
 * red: Participant has done everything they're supposed to for 0-1 days out of the last 5
 * gray: Participant cannot proceed without action by the study administrators.
 * @param {*} event 
 * @returns 
 */
exports.getStatus = async(event) => {
    const userRole = event.requestContext.authorizer.jwt.claims['cognito:preferred_role'];
    if (!userRole) return noAccess;

    const credentials = await credentialsForRole(userRole);
    const db = dbWithCredentials(credentials);

    db.getFinishedSets = getFinishedSets;

    const participantId = event.pathParameters.id;
    const humanId = event.queryStringParameters.hId;
    const preComplete = event.queryStringParameters.preComplete === '1';
    const stage2Completed = event.queryStringParameters.stage2Completed === '1';
    const homeComplete = event.queryStringParameters.homeComplete === '1';
    const postComplete = event.queryStringParameters.postComplete === '1';
    const stage2CompletedOn = event.queryStringParameters.stage2CompletedOn;

    if (!preComplete) {
        return await baselineStatus(db, participantId, 'pre');
    }

    if (!stage2Completed) {
        return await stage2Status(db, participantId, humanId);
    }

    if (!homeComplete) {
        return await stage3Status(db, participantId, humanId, stage2CompletedOn);
    }

    if (!postComplete) {
        return await baselineStatus(db, participantId, 'post');
    }
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

// ugh. We can't use db.getResultsForCurentUser('set-finished', identityId) 
// because we're using v3 of the AWS SDK here and the credentials object
// from that is incompatible with the way that db wants to use it 
// (no .promise on credentials), so we have to write this instead.
async function getFinishedSets(identityId) {
    try {
        let ExclusiveStartKey, dynResults
        let allResults = [];

        do {
            const params = {
                TableName: this.experimentTable,
                ExclusiveStartKey,
                KeyConditionExpression: `identityId = :idKey and begins_with(experimentDateTime, :expName)`,
                ExpressionAttributeValues: { ':idKey': identityId, ':expName': 'set-finished' }
            };
            dynResults = await this.query(params);
            ExclusiveStartKey = dynResults.LastEvaluatedKey;
            const results = dynResults.Items.map(i => {
                const parts = i.experimentDateTime.split('|');
                if (parts.length != 3) {
                    throw new Error(`Unexpected experimentDateTime value: ${i.experimentDateTime}. Expected three parts, but found ${parts.length}.`)
                }
                const experiment = parts[0];
                const dateTime = parts[1];
                return {
                    experiment: experiment,
                    dateTime: dateTime,
                    isRelevant: i.isRelevant,
                    results: i.results
                }
            });
            allResults = [...allResults, ...results];
        } while (dynResults.LastEvaluatedKey)
        
        return allResults;
    } catch (err) {
        this.logger.error(err);
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