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

const verified = require('../verified.js');

describe("Testing with a valid post confirmation trigger event", () => {
    let hIdExistsMock;
    beforeEach(async () => {
        await th.dynamo.createTable(process.env.USERS_TABLE, 
            [{AttributeName: 'userId', KeyType: 'HASH'}], 
            [{AttributeName: 'userId', AttributeType: 'S'}]
        );
        hIdExistsMock = jest.fn(async(hId) => false);
        verified.humanIdExists = hIdExistsMock;
    });

    test("should succeed", async() => {
        const result = await verified.handler(postConfirmationEvent);
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
        expect(userRec.Item.humanId.length).toBe(7);
        expect(userRec.Item.humanId).toBe(hIdExistsMock.mock.calls[0][0]);
    });

    test("should do nothing if the trigger is not for a signup", async() => {
        const changePwTriggerEvent = JSON.parse(postConfirmationEventJson);
        changePwTriggerEvent.triggerSource = 'PostConfirmation_ConfirmForgotPassword';
        await verified.handler(changePwTriggerEvent);
        const params = {
            TableName: process.env.USERS_TABLE,
            Key: {
                userId: changePwTriggerEvent.request.userAttributes.sub
            }
        };
        const userRec = await docClient.get(params).promise();
        expect(userRec).toEqual({});
    });

    afterEach(async () => {
        await th.dynamo.deleteTable(process.env.USERS_TABLE);
    });
});

describe("Testing human-readable ids", () => {
    let hIdExistsMock;
    beforeAll(async () => {
        await th.dynamo.createTable(process.env.USERS_TABLE, 
            [{AttributeName: 'userId', KeyType: 'HASH'}], 
            [{AttributeName: 'userId', AttributeType: 'S'}]
        );
        hIdExistsMock = jest.fn(async() => true);
        verified.humanIdExists = hIdExistsMock;
    });
    
    it("should fail if three human ids are already in the database", async () => {
        try {
            await verified.handler(postConfirmationEvent);
        } catch (err) {
            expect(err.message).toMatch(/Something went wrong/);
            expect(hIdExistsMock).toHaveBeenCalledTimes(3);
        }
    });

    it("should succeed once it finds a human id that is not in the database", async () => {
        try {
            hIdExistsMock.mockReturnValue(false).mockReturnValueOnce(true);
            await verified.handler(postConfirmationEvent);
            expect(hIdExistsMock).toHaveBeenCalledTimes(2);
        } catch (err) {
            throw err; // do this to make the test fail; we don't expect to hit this
        }
    });

    afterEach(() => {
        hIdExistsMock.mockRestore();
    });

    afterAll(async () => {
        await th.dynamo.deleteTable(process.env.USERS_TABLE);
    });
});
