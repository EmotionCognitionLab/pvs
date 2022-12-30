import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import Db from 'db/db.js';
import awsSettings from "../../../../common/aws-settings.json";

const AWS = require("aws-sdk");
const docusign = require("docusign-esign");

const region = process.env.REGION;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const DS_RSA_PRIV = process.env.DS_RSA_PRIV;
const DS_INT_KEY = process.env.DS_INT_KEY;
const DS_USER_ID = process.env.DS_USER_ID;

const dsClient = new docusign.ApiClient();
dsClient.setOAuthBasePath(awsSettings.DsOAuthUri.replace('https://', ''));


const noAccess = {
    statusCode: 401,
    body: "You do not have permission to access this information",
    headers: {
        "Access-Control-Allow-Origin": "*"
    }
};

const badRequest = {
    statusCode: 400,
    body: "Malformed request",
    headers: {
        "Access-Control-Allow-Origin": "*"
    }
}


exports.signingDone = async(event) => {
    const isValid = (param) => (param && param.trim() !== "")
    ["envelopeId", "name", "email"].forEach( (param) => {
        if (!isValid(event.queryStringParameters[param])) return badRequest;
    });

    try {
        const docClient = new AWS.DynamoDB.DocumentClient({
            endpoint: dynamoEndpoint,
            apiVersion: "2012-08-10",
            region: region,
        });
    
        const db = new Db();
        db.docClient = docClient;

        const envelopeId = event.queryStringParameters.envelopeId;
        const name = event.queryStringParameters.name;
        const email = event.queryStringParameters.email;
        await db.saveDsSigningInfo(envelopeId, name, email);

        const dest = `${awsSettings.RegistrationUri}?envelopeId=${envelopeId}`
        return {
            statusCode: 301,
            headers: {
                Location: dest
            }
        };
    } catch (err) {
        console.error(err);
        throw(err);
    }
}

exports.getSigningInfo = async(event) => {
    const envelopeId = event.queryStringParameters.envelopeId;
    if (!envelopeId || envelopeId.trim() === "") return badRequest;

    try {
        const docClient = new AWS.DynamoDB.DocumentClient({
            endpoint: dynamoEndpoint,
            apiVersion: "2012-08-10",
            region: region,
        });
    
        const db = new Db();
        db.docClient = docClient;

        const results = await db.getDsSigningInfo(envelopeId);
        console.log(JSON.stringify(results));
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-type": "application/json"
            },
            body: JSON.stringify(results.Items)
        }
    } catch (err) {
        console.error(err);
        throw(err);
    }
}

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
            Body: "Success"
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
}

async function getAccessInfo() {
    try {
        const res = await dsClient.requestJWTUserToken(DS_INT_KEY, DS_USER_ID, "signature+impersonation", DS_RSA_PRIV, 600);
        const accessToken = res.body.access_token;

        const userInfoRes = await dsClient.getUserInfo(accessToken);

        const defaultUser = userInfoRes.accounts.find(acc => acc.isDefault === "true");
        return {
            accessToken: accessToken,
            apiAccountId: defaultUser.accountId,
            basePath: `${defaultUser.baseUri}/restapi`
        };
    } catch (err) {
        console.error("Error getting DS access info", err);
        if (err.response && err.response.body) {
            console.error(`DS API status code: ${err.response.status}; message body: ${JSON.stringify(err.response.body)}`)
        }
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