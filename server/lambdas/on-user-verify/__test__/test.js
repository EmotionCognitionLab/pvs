'use strict';

const path = require('path');
require('dotenv').config({path: path.join(__dirname, './env.sh')});
const th = require('../../common-test/test-helper.js');
const { readFileSync } = require('fs');
const lambdaLocal = require("lambda-local");
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: process.env.DYNAMO_ENDPOINT, apiVersion: '2012-08-10', region: process.env.REGION})

const postConfirmationEventJson = readFileSync(path.join(__dirname, 'post-confirmation-event.json'));
const postConfirmationEvent = JSON.parse(postConfirmationEventJson);

describe("Testing with a valid post confirmation trigger event", () => {
    beforeAll(async () => {
        await th.dynamo.createTable(process.env.USERS_TABLE, 
            [{AttributeName: 'userId', KeyType: 'HASH'}], 
            [{AttributeName: 'userId', AttributeType: 'S'}]
        );
    });

    test("should succeed", async() => {
        const result = await runLambda();
        expect(result.response).toBeDefined();
        const params = {
            TableName: process.env.USERS_TABLE,
            Key: {
                userId: postConfirmationEvent.request.userAttributes.sub
            }
        };
        const userRec = await docClient.get(params).promise();
        for (const field in ['email', 'name', 'phone_number', 'sub']) {
            expect(userRec.Item[field]).toBe(postConfirmationEvent.request.userAttributes[field]);
        }
        expect(userRec.Item.createdAt.substring(0, 18)).toBe(new Date().toISOString().substring(0, 18));
        expect(userRec.Item.phone_number_verified).toBeFalsy();
    });

    afterAll(async () => {
        await th.dynamo.deleteTable(process.env.USERS_TABLE);
    });
});

async function runLambda() {
    return await lambdaLocal.execute({
        event: postConfirmationEvent,
        lambdaPath: path.join(__dirname, '../verified.js'),
        lambdaHandler: 'handler',
        environment: {USERS_TABLE: process.env.USERS_TABLE},
        verboseLevel: 0
    });
}