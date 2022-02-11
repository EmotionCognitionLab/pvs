import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand} from "@aws-sdk/lib-dynamodb";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

const region = process.env.REGION;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const stsClient = new STSClient({ region: region });
let docClient;

exports.getAll = async(event) => {
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

    return await getAllParticipants();
}

async function getAllParticipants() {
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