'use strict';

const path = require('path');
require('dotenv').config({path: path.join(__dirname, './env.sh')});
const th = require('../../common-test/test-helper.js');
const fs = require('fs/promises');
const lambdaLocal = require("lambda-local");
const AWS = require('aws-sdk');
const s3Client = new AWS.S3({endpoint: process.env.S3_ENDPOINT, apiVersion: '2006-03-01',
    s3ForcePathStyle: true});
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: process.env.DYNAMO_ENDPOINT, apiVersion: '2012-08-10', region: process.env.REGION});


const originPrefix = 'emails';
const emailKey = `${originPrefix}/7pweiur83jfjeif`;
const reportKey = `${originPrefix}/2022-09-10-09-00-58-324.game_result_report.csv`;
const engagementKey = `${originPrefix}/2022-09-13-09-00-30-347.daily_engagement_report.csv`;
const usersTable = process.env.USERS_TABLE;

afterEach(async () => {
    await th.s3.removeBucket(process.env.DEST_BUCKET);
});

describe("Saving the email attachment to S3", () => {
    describe('A valid attachment', () => {
        beforeAll(async () => {
            await th.s3.removeBucket(process.env.DEST_BUCKET);
            const emailText = await fs.readFile(path.join(__dirname, 'email-with-attachment.mime.txt'));
            await th.s3.addFile(process.env.DEST_BUCKET, emailKey, emailText);
        });
    
        test("should be saved to s3", async() => {
            const result = await runAttachmentLambda();
            expect(result.status).toBe('success');
            const files = await s3Client.listObjectsV2({
                Bucket: process.env.DEST_BUCKET,
                Prefix: process.env.DEST_PREFIX
            }).promise();
            expect(files.Contents.length).toBe(1);
        });
    });
    
    describe('A missing attachment', () => {
        beforeAll(async () => {
            const emailText = await fs.readFile(path.join(__dirname, 'email-without-attachment.mime.txt'));
            await th.s3.addFile(process.env.DEST_BUCKET, emailKey, emailText);
        });
    
        test("should succeed", async() => {
            const result = await runAttachmentLambda();
            expect(result.status).toBe('success');
        });
    });
});

const user = {
    userId: 'abc123',
    email: 'someone@example.com',
    name: 'Kim',
    phone_number: '012-345-6789',
    sub: 'abc123'
};

const lumosAcct = {
    email: 'heartbeam1@example.com',
    owner: user.userId
};

describe("Processing reports from S3", () => {
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

        await th.dynamo.createTable(process.env.LUMOS_ACCT_TABLE,
            [{AttributeName: 'email', KeyType: 'HASH'}],
            [{AttributeName: 'email', AttributeType: 'S'}]
        );

        await docClient.put({TableName: process.env.LUMOS_ACCT_TABLE, Item: lumosAcct}).promise();
    });

    describe('A valid game result report', () => {
        beforeAll(async () => {
            await th.s3.removeBucket(process.env.DEST_BUCKET);
            const reportText = await fs.readFile(path.join(__dirname, 'game-result-report-1-user.csv'));
            await th.s3.addFile(process.env.DEST_BUCKET, reportKey, reportText);
        });

        test("should write the game play data to dynamodb", async () => {
            const result = await runReportsLambda(reportKey);
            expect(result.status).toBe('success');
            confirmReportDataWritten();
        });
    });

    describe('A user engagement report', () => {
        beforeAll(async () => {
            await th.s3.removeBucket(process.env.DEST_BUCKET);
            const reportText = await fs.readFile(path.join(__dirname, 'engagement-report.csv'));
            await th.s3.addFile(process.env.DEST_BUCKET, engagementKey, reportText);
        });

        test('should be skipped', async () => {
            const result = await runReportsLambda(engagementKey);
            expect(result.status).toBe('ignored');
        });
    });

    describe('A game result report with users whose account we cannot find', () => {
        beforeAll(async () => {
            await th.s3.removeBucket(process.env.DEST_BUCKET);
            const reportText = await fs.readFile(path.join(__dirname, 'game-result-report-2-users.csv'));
            await th.s3.addFile(process.env.DEST_BUCKET, reportKey, reportText);
        });

        test("should not stop us from writing the data for users we do have accounts for", async () => {
            const result = await runReportsLambda(reportKey);
            expect(result.status).toBe('success');
            confirmReportDataWritten();
        });
    });

    afterAll(async () => {
        await th.dynamo.deleteTable(process.env.USERS_TABLE);
        await th.dynamo.deleteTable(process.env.LUMOS_ACCT_TABLE);
    });
});

async function confirmReportDataWritten() {
    const userQueryRes = await docClient.query({
        TableName: usersTable, 
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {":userId": user.userId},
    }).promise();
    expect(userQueryRes.Items.length).toBe(1);
    const testUser = userQueryRes.Items[0];
    expect(testUser.lumosGames).toBeDefined();
    expect(testUser.lumosGames.length).toBe(6);
    const expectedGames = ['Color Match Web', 'Raindrops Web', 'Word Bubbles Web', 'Penguin Pursuit Web', 'Brain Shift Web', 'Memory Match Web'];
    testUser.lumosGames.forEach(gamePlay => {
        expect(Object.keys(gamePlay).length).toBe(1);
        const gameName = Object.keys(gamePlay)[0];
        expect(expectedGames).toContain(gameName);
        if (gameName === 'Color Match Web') {
            expect(gamePlay[gameName]).toBe(2);
        } else {
            expect(gamePlay[gameName]).toBe(1);
        }
    });
}

async function runAttachmentLambda() {
    const putEventJson = await fs.readFile(path.join(__dirname, 's3-put-event.json'));
    const putEvent = JSON.parse(putEventJson);
    putEvent.Records[0].s3.bucket.name = process.env.DEST_BUCKET;
    putEvent.Records[0].s3.object.key = emailKey;
    const result = await lambdaLocal.execute({
        event: putEvent,
        lambdaPath: path.join(__dirname, '../process-lumosity-emails.js'),
        lambdaHandler: 'saveattachments',
        verboseLevel: 0
    });
    return result;
}

async function runReportsLambda(fileKey) {
    const putEventJson = await fs.readFile(path.join(__dirname, 's3-put-event.json'));
    const putEvent = JSON.parse(putEventJson);
    putEvent.Records[0].s3.bucket.name = process.env.DEST_BUCKET;
    putEvent.Records[0].s3.object.key = fileKey;
    const result = await lambdaLocal.execute({
        event: putEvent,
        lambdaPath: path.join(__dirname, '../process-lumosity-emails.js'),
        lambdaHandler: 'processreports',
        verboseLevel: 0
    });
    return result;
}





