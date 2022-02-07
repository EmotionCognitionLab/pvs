import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

const region = process.env.REGION;
const experimentTable = process.env.EXPERIMENT_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const datafilesBucket = process.env.DATAFILE_BUCKET;
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
    docClient = new DynamoDBClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region, credentials: credentials });
    s3Client = new S3Client({region: region, credentials: credentials });
    const experimentName = event.queryStringParameters.experiment;
    const results = getExperimentData(experimentName);
    const fileDetails = saveDataToS3(JSON.stringify(results));

    return {
        statusCode: 302,
        headers: {
            Location: fileDetails.url,
            "Content-type": "application/json",
            "Content-Disposition": `attachment; filename=${fileDetails.name}`,
            "Content-Transfer-Encoding": "binary",
            "Content-Length": fileDetails.length
        }
    }
}

getExperimentData = async(experimentName) => {
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

saveDataToS3 = async(results, experimentName) => {
    const d = new Date();
    const fileKey = `${experimentName}.${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, 0)}-${String(d.getDate() + 1).padStart(2, 0)}.${String(d.getHours()).padStart(2, 0)}:${String(d.getMinutes()).padStart(2, 0)}:${String(d.getSeconds()).padStart(2, 0)}:${d.getMilliseconds()}.json`;
    const put = new PutObjectCommand({
        Bucket: datafilesBucket,
        Body: results,
        ContentLength: results.length,
        ContentType: application/json,
        Key: fileKey
    });
    await s3Client.send(put);
    const getCommand = new GetObjectCommand({
        Bucket: datafilesBucket,
        Key: fileKey
    });
    const url = await getSignedUrl(s3Client, getCommand, {expiresIn: 1000 * 60 * 60 * 24}); // good for 24 hours
    return {
        name: fileKey,
        length: results.length,
        url: url
    };
}