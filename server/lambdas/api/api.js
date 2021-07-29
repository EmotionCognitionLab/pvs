const AWS = require("aws-sdk");
const region = process.env.REGION;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region});

exports.getUser = async (event) => {
    try {
        const userId = event.requestContext.authorizer.jwt.claims.sub;
        const params = {
            TableName: usersTable,
            KeyConditionExpression: "userId = :idKey",
            ExpressionAttributeValues: { ":idKey": userId }
        };
        const dynResults = await docClient.query(params).promise();
        if (dynResults.Items.length === 0) {
            return {};
        }
        if (dynResults.Items.length > 1) {
            throw new HttpError(`Found multiple users with userId ${userId}.`, 409);
        }
        return dynResults.Items[0];
    } catch (err) {
        console.error(err);
        if (!(err instanceof HttpError)) {
            err = new HttpError(err.message);
        }
        return errorResponse(err);
    }
}

function successResponse(data) {
    return {
        "statusCode": 200,
        "body": JSON.stringify(data)
    }
}

function errorResponse(err) {
    const resp = {
        "body": JSON.stringify(err.message)
    } 

    if (err.statusCode) {
        resp["statusCode"] = err.statusCode;
    }

    if (err.code) {
        resp["headers"]["x-amzn-ErrorType"] = err.code;
        resp["body"] = `${err.code}: ${JSON.stringify(err.message)}`;
    }

    return resp;
}

class HttpError extends Error {
    constructor(message, statusCode=500) {
        super(message);
        this.name = "HttpError";
        this.statusCode = statusCode;
    }
}

