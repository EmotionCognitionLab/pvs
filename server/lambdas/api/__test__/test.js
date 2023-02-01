'use strict';

const path = require('path');
require('dotenv').config({path: path.join(__dirname, './env.sh')});
const th = require('../../common-test/test-helper.js');
const lambdaLocal = require("lambda-local");
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: process.env.DYNAMO_ENDPOINT, apiVersion: '2012-08-10', region: process.env.REGION})

const conditions = require('../api.js').validConditions;

const user = {
    userId: 'abc123',
    email: 'someone@example.com',
    name: 'Kim',
    phone_number: '012-345-6789',
    sub: 'abc123'
};

describe("API call for user", () => {

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
        const userRec = await fetchUser(user.userId);
        expect(userRec.name).toBe(update.name);
    });

    afterAll(async () => {
        await th.dynamo.deleteTable(process.env.USERS_TABLE);
    });
});

describe("Assign to condition basic validation", () => {

    test("should fail if the choice for bornSex is empty", async() => {
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent());
        expect(result.statusCode).toBe(400);
    });

    test("should fail if the choice for bornSex is not valid", async() => {
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent('vader'));
        expect(result.statusCode).toBe(400);
    });

    test("should fail if the choice for bornSex is 'Intersex' and the choice for sex description is empty", async() => {
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent('Intersex'));
        expect(result.statusCode).toBe(400);
    });

    test("should fail if the choice for bornSex is 'Intersex' and the choice for sex description is not valid", async() => {
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent('Intersex', 'darim'));
        expect(result.statusCode).toBe(400);
    });
});

describe("Assign to condition", () => {

    beforeEach(async () => {
        await th.dynamo.createTable(process.env.USERS_TABLE, 
            [{AttributeName: 'userId', KeyType: 'HASH'}], 
            [{AttributeName: 'userId', AttributeType: 'S'}]
        );
    });

    test("should succeed with valid data", async() => {
        const bornSex = 'Female';
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent(bornSex));
        expect(result.statusCode).toBe(200);
        const userRec = await fetchUser(user.userId);
        expect(userRec.condition.bornSex).toBe(bornSex);
        expect(userRec.condition.sexDesc).toBe('');
        expect(userRec.condition.assignedSex).toBe(bornSex);
        const now = new Date().toISOString();
        expect(userRec.condition.assignedDate.startsWith(now.substring(0, 16))).toBe(true);
        expect(conditions).toContain(userRec.condition.assigned);
    });

    test("should fail if the user has already been assigned to condition", async () => {
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent('Male', null, user.userId));
        expect(result.statusCode).toBe(200);
        const userRec1 = await fetchUser(user.userId);
        const secondTry = await runLambda('/condition', 'POST', buildConditionAssignmentEvent('Female', null, user.userId));
        expect(secondTry.statusCode).toBe(500);
        const userRec2 = await fetchUser(user.userId);
        expect(userRec2.condition.bornSex).toBe(userRec1.condition.bornSex);
        expect(userRec2.condition.assigned).toBe(userRec1.condition.assigned);
    });

    test("should assign participants born Intersex the sex they identify as (if it's not Other)", async () => {
        const bornSex = 'Intersex';
        const sexDesc = 'Female';
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent(bornSex, sexDesc));
        expect(result.statusCode).toBe(200);
        const userRec = await fetchUser(user.userId);
        expect(userRec.condition.assignedSex).toBe('Female');
    });

    test("should assign participants born Intersex who identify as Other to Male", async() => {
        const bornSex = 'Intersex';
        const sexDesc = 'Other';
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent(bornSex, sexDesc));
        expect(result.statusCode).toBe(200);
        const userRec = await fetchUser(user.userId);
        expect(userRec.condition.bornSex).toBe(bornSex);
        expect(userRec.condition.sexDesc).toBe(sexDesc);
        expect(userRec.condition.assignedSex).toBe('Male');
    });

    test("should assign the participant to the opposite condition of the participant of the same assigned sex most recently assigned to condition if there are an odd number of participants with the same assigned sex", async () => { 
        const targetSex = 'Male';
        const maleUser = 
        {
            userId: 'def456',
            email: 'noone@example.com',
            name: 'Pat',
            phone_number: '987-654-3210',
            sub: 'def456',
            condition: {
                bornSex: targetSex,
                sexDesc: '',
                assignedSex: targetSex,
                assignedDate: '2022-04-01T11:00:01.123Z',
                assigned: 'A'
            }
        };
        await loadAndConfirmUsers([maleUser], 'Male', 1);

        const uid = 'afjkf393';
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent(targetSex, '', uid));
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.condition).toBe('B');
        const userRec = await fetchUser(uid);
        expect(userRec.condition).not.toBe(null);
        expect(userRec.condition.assigned).toBe('B');
    });

    test("should ignore participants of other sexes when doing assignment for a given sex", async () => {
        const users = [
            {
                userId: 'def456',
                email: 'noone@example.com',
                name: 'Pat',
                phone_number: '987-654-3210',
                sub: 'def456',
                condition: {
                    bornSex: 'Male',
                    sexDesc: '',
                    assignedSex: 'Male',
                    assignedDate: '2022-04-01T11:00:01.123Z',
                    assigned: 'A'
                }
            },
            {
                userId: 'abc123',
                email: 'someone@example.com',
                name: 'Kim',
                phone_number: '012-345-6789',
                sub: 'abc123',
                condition: {
                    bornSex: 'Female',
                    sexDesc: '',
                    assignedSex: 'Female',
                    assignedDate: '2022-04-02T10:09:37.431Z',
                    assigned: 'B'
                }
            }
        ];

        await loadAndConfirmUsers(users, 'Female', 1);

        const uid = 'afjkf393';
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent('Female', '', uid));
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.condition).toBe('A');
        const userRec = await fetchUser(uid);
        expect(userRec.condition).not.toBe(null);
        expect(userRec.condition.assigned).toBe('A');
    });

    test("should use the condition of the most recently assigned user of the same sex when doing assignment", async () => {
        const users = [
            {
                userId: 'def456',
                email: 'noone@example.com',
                name: 'Pat',
                phone_number: '987-654-3210',
                sub: 'def456',
                condition: {
                    bornSex: 'Female',
                    sexDesc: '',
                    assignedSex: 'Female',
                    assignedDate: '2022-04-01T11:00:01.123Z',
                    assigned: 'A'
                }
            },
            {
                userId: 'abc123',
                email: 'someone@example.com',
                name: 'Kim',
                phone_number: '012-345-6789',
                sub: 'abc123',
                condition: {
                    bornSex: 'Female',
                    sexDesc: '',
                    assignedSex: 'Female',
                    assignedDate: '2022-04-02T10:09:37.431Z',
                    assigned: 'B'
                }
            },
            {
                userId: 'ghi789',
                email: 'g@example.com',
                name: 'Alex',
                phone_number: '190-287-3456',
                sub: 'ghi789',
                condition: {
                    bornSex: 'Female',
                    sexDesc: '',
                    assignedSex: 'Female',
                    assignedDate: '2022-04-03T11:00:01.123Z',
                    assigned: 'B'
                }
            }
        ];

        await loadAndConfirmUsers(users, 'Female', 3);

        const uid = 'aeui320';
        const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent('Female', '', uid));
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.condition).toBe('A');
        const userRec = await fetchUser(uid);
        expect(userRec.condition).not.toBe(null);
        expect(userRec.condition.assigned).toBe('A');
    });

    afterEach(async () => {
        await th.dynamo.deleteTable(process.env.USERS_TABLE);
    });
});

describe("assignment to condition tested with many users", () => {
    const numUsers = 50;
    let males;
    let females;

    beforeAll(async() => {
        await th.dynamo.createTable(process.env.USERS_TABLE, 
            [{AttributeName: 'userId', KeyType: 'HASH'}], 
            [{AttributeName: 'userId', AttributeType: 'S'}]
        );

        const users = [];
        for (let i = 0; i<numUsers * 2; i++) {
            users.push({userId: i.toString()})
        }

        for (const u of users) {
            await docClient.put({TableName: process.env.USERS_TABLE, Item: u}).promise();
        }
        const allUsers = await docClient.scan({TableName: process.env.USERS_TABLE}).promise();
        expect(allUsers.Count).toBe(users.length);

        const randGender = () => Math.random() < 0.5 ? 'Male' : 'Female';

        for (let i = 0; i<numUsers*2; i++) {
            const result = await runLambda('/condition', 'POST', buildConditionAssignmentEvent(randGender(), '', users[i].userId));
            expect(result.statusCode).toBe(200);
        }

        const result = await docClient.scan({TableName: process.env.USERS_TABLE}).promise();
        males = result.Items.filter(i => i.condition.assignedSex === 'Male');
        females = result.Items.filter(i => i.condition.assignedSex === 'Female');
        expect(males.length + females.length).toEqual(users.length);
    });

    test("should never assign more than two users in a row to the same condition", async () => {
        const sortByDate = (a,b) => {
            if (a.condition.assignedDate > b.condition.assignedDate) return 1;
            if (a.condition.assignedDate < b.condition.assignedDate) return -1;
            return 0;
        }
        [males, females].forEach(sex => {
            sex.sort(sortByDate);
            const conditionStr = sex.map(u => u.condition.assigned).join('');
            // we should never have more than two of the same condition in a row
            // so when we join all the conditions together into one long string
            // they should never have a run of 'AAA...' or 'BBB...'.
            expect(conditionStr).toEqual(expect.not.stringContaining('AAA'));
            expect(conditionStr).toEqual(expect.not.stringContaining('BBB'));
        });
    });

    test("should have an even number of users assigned to each condition if an even number of users have been created, or a difference of 1 between the numbers for each condition if an odd number of users have been created", async () => {
        [males, females].forEach(sex => {
            const condA = sex.filter(u => u.condition.assigned === 'A');
            const condB = sex.filter(u => u.condition.assigned === 'B');
            expect(condA.length + condB.length).toEqual(sex.length);
            if (sex.length % 2 == 0) {
                expect(condA.length).toEqual(condB.length);
            } else {
                expect(Math.abs(condA.length - condB.length)).toEqual(1);
            }
        });
    });

    afterAll(async () => {
        await th.dynamo.deleteTable(process.env.USERS_TABLE);
    });
});

async function fetchUser(userId) {
    const params = {
        TableName: process.env.USERS_TABLE,
        Key: {
            userId: userId
        }
    };
    const userRec = await docClient.get(params).promise();
    return userRec.Item;
}

async function loadAndConfirmUsers(users, targetSex, expectedTargetSexCount) {
    for (const u of users) {
        await docClient.put({TableName: process.env.USERS_TABLE, Item: u}).promise();
    }
    const allUsers = await docClient.scan({TableName: process.env.USERS_TABLE}).promise();
    expect(allUsers.Count).toBe(users.length);
    const targetUsers = allUsers.Items.filter(u => u.condition && u.condition.assignedSex === targetSex);
    expect(targetUsers.length).toBe(expectedTargetSexCount);
}

function buildConditionAssignmentEvent(bornSex, sexDesc, userId=user.userId) {
    return {
        body: JSON.stringify({bornSex: bornSex, sexDesc: sexDesc}), 
        requestContext: {
            authorizer: {jwt: {claims: {sub: userId}}}
        }
    };
}

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