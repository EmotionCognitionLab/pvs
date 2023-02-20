import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand} from "@aws-sdk/lib-dynamodb";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

const region = process.env.REGION;
const experimentTable = process.env.EXPERIMENT_TABLE;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const datafilesBucket = process.env.DATAFILES_BUCKET;
const stsClient = new STSClient({ region: region });
let docClient;
let s3Client;

exports.getData = async(event) => {
    const userRole = event.requestContext.authorizer.jwt.claims['cognito:preferred_role'];
    if (!userRole) {
        return {
            statusCode: 401,
            body: "You do not have permission to access this information"
        }
    }
    const assumeRoleCmd = new AssumeRoleCommand({RoleArn: userRole, RoleSessionName: "lambdaCognitoUser"});
    const roleData = await stsClient.send(assumeRoleCmd);
    const credentials = {
        accessKeyId: roleData.Credentials.AccessKeyId,
        secretAccessKey: roleData.Credentials.SecretAccessKey,
        sessionToken: roleData.Credentials.SessionToken
    };
    const dbClient = new DynamoDBClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region, credentials: credentials });
    docClient = DynamoDBDocumentClient.from(dbClient);
    s3Client = new S3Client({region: region, credentials: credentials });

    const experimentName = event.pathParameters.experiment;
    const ids = await getAllUsers();
    const allResults = [];
    for (let {iid, hid} of ids) {
        if (iid === null || Object.keys(iid).length === 0) continue;
        const results = await getExperimentData(experimentName, iid, hid);
        if (results.length > 0) allResults.push(...results);
    }
    
    if (allResults.length === 0) {
        return { empty: true }
    }
    const fileDetails = await saveDataToS3(JSON.stringify(allResults), experimentName);
    return { url: fileDetails.url }

}

async function getAllUsers() {
    const results = [];
    const baseParams = {
        TableName: usersTable,
        ProjectionExpression: 'userId,humanId'
    };
    const scan = new ScanCommand(baseParams);
    let lastKey = null;
    try {
        do {
            scan.ExclusiveStartKey = lastKey === null ? {} : lastKey;
            const response = await docClient.send(scan);
            if (response.Items.length > 0) results.push(...response.Items);
            lastKey = response.LastEvaluatedKey;
        } while (lastKey)
    } catch (err) {
        console.error(err);
        throw err;
    }
    const ids = [];
    for (let r of results) {
        const identityId = await getIdentityIdForUserId(r.userId);
        if (identityId !== null) ids.push({iid: identityId, hid: r.humanId});
    }
    return ids;
}

// TODO this is now in common/db; use it from there
async function getIdentityIdForUserId(userId) {
    const baseParams = {
        TableName: experimentTable,
        IndexName: 'userId-experimentDateTime-index',
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {":userId": userId},
        Limit: 1,
        ProjectionExpression: 'identityId'
    };
    const query = new QueryCommand(baseParams);
    const result = await docClient.send(query);
    if (result.Items.length === 0) return null;
    return result.Items[0].identityId;
}

async function getExperimentData(experimentName, identityId, humanId) {
    const results = [];
    const baseParams = {
        TableName: experimentTable,
        KeyConditionExpression: "identityId = :identityId AND begins_with(experimentDateTime, :experimentName)",
        ExpressionAttributeValues: {":identityId": identityId, ":experimentName": experimentName},
    };
    const query = new QueryCommand(baseParams);
    let lastKey = null;
    try {
        do {
            query.ExclusiveStartKey = lastKey === null ? {} : lastKey;
            const response = await docClient.send(query);
            response.Items.forEach(item => {
                const parts = item.experimentDateTime.split("|");
                if (parts.length != 3) {
                    throw new Error(`Unexpected experimentDateTime value: ${i.experimentDateTime}. Expected three parts, but found ${parts.length}.`)
                }
                const [experiment, dateTime, _index] = parts;
                results.push({
                    ...item.results,
                    dateTime,
                    experiment,
                    isRelevant: item.isRelevant,
                    userId: humanId,
                });
            });
            lastKey = response.LastEvaluatedKey;
        } while (lastKey)
    } catch (err) {
        console.error(err);
        throw err;
    }
    return results;
}

async function saveDataToS3(results, experimentName) {
    const d = new Date();
    const localDate = d.toLocaleString("en", {
        year: "numeric",
        month:"2-digit",
        day: "2-digit",
        hour12:false,
        hour:"2-digit",
        minute:"2-digit",
        second:"2-digit", 
        timeZone:"America/Los_Angeles"
    }).replace(/\//g, ".").replace(", ", "-").replace(/:/g, ".");
    const fileKey = `${experimentName}.${localDate}.json`;
    const putParams = {
        Bucket: datafilesBucket,
        Body: results,
        ContentType: "application/json",
        ContentDisposition: `attachment; filename=${fileKey}`,
        Key: fileKey
    };
    const put = new PutObjectCommand(putParams);
    await s3Client.send(put);
    const getCommand = new GetObjectCommand({
        Bucket: datafilesBucket,
        Key: fileKey
    });
    const url = await getSignedUrl(s3Client, getCommand, {expiresIn: 60 * 60 * 24}); // good for 24 hours
    return {
        name: fileKey,
        length: results.length,
        url: url
    };
}