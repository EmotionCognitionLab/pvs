import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import Db from 'db/db.js';
import { ApiClient } from "docusign-esign";

const AWS = require("aws-sdk");
const region = process.env.REGION;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

const noAccess = {
    statusCode: 401,
    body: "You do not have permission to access this information"
};

exports.callback = async(event) => {
    const userRole = event.requestContext.authorizer.jwt.claims['cognito:preferred_role'];
    if (!userRole) return noAccess;
    
    try {
        const credentials = await credentialsForRole(userRole);
        const db = dbWithCredentials(credentials);

        const code = event.queryStringParameters.code;
        const clientId = process.env.DS_CLIENT_ID;
        const clientSecret = process.env.DS_CLIENT_SECRET;
        const dsApiClient = new ApiClient({basePath: process.env.DS_BASE_PATH});
        const result = await dsApiClient.generateAccessToken(clientId, clientSecret, code);
        const acccessToken = result.accessToken;
        const refreshToken = result.refreshToken;
        const expiresIn = result.expiresIn;
        const expiresAt = new Date(Date.now() + (1000 * expiresIn)).toISOString();

        const userId = event.requestContext.authorizer.jwt.claims.sub
        await db.saveDsOAuthCreds(userId, acccessToken, refreshToken, expiresAt);
        await db.updateUser(userId, {hasDs: true});
        return {
            statusCode: 200,
            Body: "Successn"
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
}

// for future use with JWT auth
async function getDsKey(credentials) {
    const params = {
        Bucket: process.env.DS_BUCKET,
        Key: process.env.DS_KEY
    }
    const command = new GetObjectCommand(params);
    const s3Client = new S3Client({ region: region, credentials: credentials });
    return await (await s3Client.send(command)).Body.text();
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