const AWS = require("aws-sdk");
const region = process.env.REGION;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region});

exports.handler = async (event) => {
    const path = event.rawPath;
    if (path === "/user") {
        return getUser(event);
    }
    if (path === "/user/update") {
        return updateUser(event);
    }
    return errorResponse({statusCode: 400, message: `Unknown operation "${path}"`});
}

getUser = async (event) => {
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

updateUser = async(event) => {
    try {
        const userId = event.requestContext.authorizer.jwt.claims.sub;
        const updates = JSON.parse(event.body);
        if (!updates) {
            return errorResponse({statusCode: 400, message: "No updates found"});
        }

        const notModifiable = ['userId', 'createdAt', 'email', 'phone_number'];
        const allowedKeys = Object.keys(updates).filter(k => !notModifiable.includes(k));
        if (allowedKeys.length === 0) {
            return errorResponse({statusCode: 400, message: "No updates for allowed fields found"});
        }

        const expressionAttrVals = {};
        const expressionAttrNames = {};
        let updateExpression = 'set';
        for (const prop of allowedKeys) {
            const propName = `#${prop}`;
            const propVal = `:${prop}`
            expressionAttrNames[propName] = prop;
            expressionAttrVals[propVal] = updates[prop];
            updateExpression += ` ${propName} = ${propVal}`
        }
        const params = {
            TableName: usersTable,
            Key: { userId: userId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttrNames,
            ExpressionAttributeValues: expressionAttrVals
        };
        await docClient.update(params).promise();
        return successResponse({msg: "update successful"});
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

