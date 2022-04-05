const AWS = require("aws-sdk");
const region = process.env.REGION;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region});

// For assignment to condition participants are asked their birth sex,
// and, iff the answer is 'Intersex', how they describe their sex.
const validSex = ['Male', 'Female', 'Intersex'];
const validSexDesc = ['Male', 'Female', 'Other'];

// The possible conditions a user can be assigned to
// exported for testing
export const validConditions = ['A', 'B'];

exports.handler = async (event) => {
    const path = event.requestContext.http.path;
    const method = event.requestContext.http.method;
    if (path === "/self") {
        if (method === "GET") {
            return getSelf(event.requestContext.authorizer.jwt.claims.sub);
        }
        if (method === "PUT") {
            return updateSelf(event.requestContext.authorizer.jwt.claims.sub, JSON.parse(event.body));
        }
    }
    if (path === "/condition" && method === "POST") {
        return assignToCondition(event.requestContext.authorizer.jwt.claims.sub, JSON.parse(event.body))
    }
    return errorResponse({statusCode: 400, message: `Unknown operation "${method} ${path}"`});
}

const getSelf = async (userId) => {
    try {
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

const updateSelf = async(userId, updates) => {
    try {
        if (!updates) {
            return errorResponse({statusCode: 400, message: "No updates found"});
        }

        const notModifiable = ['userId', 'createdAt', 'email'];
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

const assignToCondition = async(userId, data) => {
    const bornSex = data['bornSex'];
    const sexDesc = data['sexDesc'] ? data['sexDesc'] : '';
    if (!validSex.includes(bornSex)) {
        return errorResponse({
            message: `${bornSex} is not a valid option.`,
            statusCode: 400
        });
    }
    if (bornSex === 'Intersex' && !validSexDesc.includes(sexDesc)) {
        return errorResponse({
            message: `${sexDesc} is not a valid option.`,
            statusCode: 400
        });
    }
    
    // per the spec, assign sex to be Male if they were born
    // Intersex and identify as Other
    let assignedSex;
    if (bornSex !== 'Intersex') {
        assignedSex = bornSex;
    } else if (sexDesc === 'Other') {
        assignedSex = 'Male'
    } else {
        assignedSex = sexDesc;
    }

    // get all the users (we expect max # of total users to be ~200)
    // and filter for those with the same assignedSex
    try {
        const params = {
            TableName: usersTable,
            FilterExpression: '#condition.assignedSex = :as',
            ExpressionAttributeNames: {'#condition': 'condition' },
            ExpressionAttributeValues: {':as': assignedSex }
        };

        const result = await docClient.scan(params).promise();
        let condition;
        if (result.Count % 2 === 0) {
            // randomly assign to condition
            if (Math.random() <= 0.5) {
                condition = validConditions[0];
            } else {
                condition = validConditions[1];
            }

        } else {
            // sort results by assignedDate and assign to the opposite of
            // the most recently assigned person
            result.Items.sort((a, b) => {
                if (a.condition.assignedDate > b.condition.assignedDate) return -1;
                if (a.condition.assignedDate < b.condition.assignedDate) return 1;
                return 0;
            });
            const lastAssigned = result.Items[0];
            if (lastAssigned.condition.assigned === validConditions[0]) {
                condition = validConditions[1];
            } else if (lastAssigned.condition.assigned === validConditions[1]) {
                condition = validConditions[0]
            } else {
                return errorResponse({
                    message: `Unexpected condition '${lastAssigned.condition.assigned}' found; unable to assign ${userId} to condition`,
                    statusCode: 500
                });
            }
        }

        // save the data
        const conditionData = {
            bornSex: bornSex,
            sexDesc: sexDesc,
            assignedSex: assignedSex,
            assigned: condition,
            assignedDate: new Date().toISOString()
        };
        const conditionParams = {
            TableName: usersTable,
            Key: { userId: userId },
            UpdateExpression: 'set #condition = :condition',
            ExpressionAttributeNames: { '#condition': 'condition' },
            ExpressionAttributeValues: { ':condition': conditionData }
        };
        await docClient.update(conditionParams).promise();
        return successResponse({condition: condition});
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

