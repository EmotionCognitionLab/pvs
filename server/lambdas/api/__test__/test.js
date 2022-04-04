'use strict';

const path = require('path');
require('dotenv').config({path: path.join(__dirname, './env.sh')});
const th = require('../../common-test/test-helper.js');
const lambdaLocal = require("lambda-local");
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: process.env.DYNAMO_ENDPOINT, apiVersion: '2012-08-10', region: process.env.REGION})

describe("API call for user", () => {
    const user = {
        userId: 'abc123',
        email: 'someone@example.com',
        name: 'Kim',
        phone_number: '012-345-6789',
        sub: 'abc123'
    }
    beforeAll(async () => {
        await th.dynamo.createTable(process.env.USERS_TABLE, 
            [{AttributeName: 'userId', KeyType: 'HASH'}], 
            [{AttributeName: 'userId', AttributeType: 'S'}]
        );
        const params = {
            TableName: process.env.USERS_TABLE,
            Item: user
        };
        await docClient.put(params).promise();
    });

    test("GET should succeed", async() => {
        const result = await runLambda('/self', 'GET', {requestContext: {authorizer: {jwt: {claims: {sub: user.userId}}}}});
        for (const field in ['email', 'name', 'phone_number', 'sub']) {
            expect(result[field]).toBe(user[field]);
        }
    });

    test("PUT should succeed", async() => {
        const update = {name: 'Tom'};
        const updateJson = JSON.stringify(update);
        const result = await runLambda('/self', 'PUT', {
            body: updateJson,
            requestContext: {authorizer: {jwt: {claims: {sub: user.userId}}}}
        });
        expect(result.statusCode).toBe(200);
        const params = {
            TableName: process.env.USERS_TABLE,
            Key: {
                userId: user.userId
            }
        };
        const userRec = await docClient.get(params).promise();
        expect(userRec.Item['name']).toBe(update.name);
    });

    afterAll(async () => {
        await th.dynamo.deleteTable(process.env.USERS_TABLE);
    });
});

async function runLambda(httpPath, method, event) {
    Object.assign(event.requestContext,{ http: { path: httpPath, method: method } });
    return await lambdaLocal.execute({
        event: event,
        lambdaPath: path.join(__dirname, '../api.js'),
        lambdaHandler: 'handler',
        environment: {USERS_TABLE: process.env.USERS_TABLE},
        verboseLevel: 0
    });
}