import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand} from "@aws-sdk/lib-dynamodb";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

const region = process.env.REGION;
const experimentTable = process.env.EXPERIMENT_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const datafilesBucket = process.env.DATAFILES_BUCKET;
const stsClient = new STSClient({ region: region });
let docClient;
let s3Client;

exports.handler = async (event) => {
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
    const experimentName = event.queryStringParameters.experiment;
    const results = await getExperimentData(experimentName);

    if (results.length === 0) {
        return { empty: true }
    }

    const fileDetails = await saveDataToS3(JSON.stringify(results), experimentName);
    return { url: fileDetails.url }
}

async function getExperimentData(experimentName) {
    const results = [];
    const baseParams = {
        TableName: experimentTable,
        FilterExpression: "begins_with(experimentDateTime, :experimentName)",
        ExpressionAttributeValues: {":experimentName": experimentName},
    };
    const scan = new ScanCommand(baseParams);
    let lastKey = null;
    try {
        do {
            scan.ExclusiveStartKey = lastKey === null ? {} : lastKey;
            const response = await docClient.send(scan);
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
                    userId: item.userId,
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
