'use strict';

const path = require('path');
require('dotenv').config({path: path.join(__dirname, './env.sh')});
const th = require('../../common-test/test-helper.js');
const fs = require('fs/promises');
const lambdaLocal = require("lambda-local");
const AWS = require('aws-sdk');
const s3Client = new AWS.S3({endpoint: process.env.S3_ENDPOINT, apiVersion: '2006-03-01'});

const originPrefix = 'emails';
const emailKey = `${originPrefix}/7pweiur83jfjeif`;

afterEach(async () => {
    await th.s3.removeBucket(process.env.DEST_BUCKET);
});

describe('testing with valid attachment', () => {
    beforeAll(async () => {
        await th.s3.removeBucket(process.env.DEST_BUCKET);
        const emailText = await fs.readFile(path.join(__dirname, 'email-with-attachment.mime.txt'));
        await th.s3.addFile(process.env.DEST_BUCKET, emailKey, emailText);
    });

    test("should write the attachment to s3", async() => {
        const result = await runLambda();
        expect(result.status).toBe('success');
        const files = await s3Client.listObjectsV2({
            Bucket: process.env.DEST_BUCKET,
            Prefix: process.env.DEST_PREFIX
        }).promise();
        expect(files.Contents.length).toBe(1);
    });
});

describe('testing without attachment', () => {
    beforeAll(async () => {
        const emailText = await fs.readFile(path.join(__dirname, 'email-without-attachment.mime.txt'));
        await th.s3.addFile(process.env.DEST_BUCKET, emailKey, emailText);
    });

    test("should succeed", async() => {
        const result = await runLambda();
        expect(result.status).toBe('success');
    });
});

async function runLambda() {
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






