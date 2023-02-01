"use strict";

const AWS = require('aws-sdk');
import Database from 'better-sqlite3';
import { mkdtemp, rm, writeFile } from 'fs/promises';
const path = require('path');

const s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  region: process.env.AWSREGION,
  endpoint: process.env.S3_ENDPOINT,
  s3ForcePathStyle: true
});

const region = process.env.REGION;
const segmentsTable = process.env.SEGMENTS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region});

export async function savesegments(event) {
    const record = event.Records[0];
    // Retrieve the database
    const request = {
        Bucket: record.s3.bucket.name,
        Key: decodeURIComponent(record.s3.object.key),
    };
    let tmpDir;
    let db;
  
    try {
        // retrieve sqlite file from s3
        tmpDir = await mkdtemp('/tmp/');
        const dbPath = path.join(tmpDir, 'temp.sqlite');
        const data = await s3.getObject(request).promise();
        await writeFile(dbPath, data.Body);

        // check to see which segments we need from it
        const humanId = request.Key.split('/')[0];
        const lastUploadTime = await lastUploadedSegmentTime(humanId, false);

        // get those segments from the sqlite db
        db = new Database(dbPath);
        const stmt = db.prepare('select * from segments where end_date_time > ?;');
        const res = stmt.all(lastUploadTime);

        // write them to the segments table in dynamoDb
        await writeSegments(humanId, res, false);

        // repeat for rest segments
        const lastRestUploadTime = await lastUploadedSegmentTime(humanId, true);

        // get those segments from the sqlite db
        const restStmt = db.prepare('select * from rest_segments where end_date_time > ?;');
        const restRes = restStmt.all(lastRestUploadTime);

        // write them to the segments table in dynamoDb
        await writeSegments(humanId, restRes, true);

        return {status: "success"};
    } catch (err) {
        console.error(`Error trying to process sqlite db (s3 key: ${request.Key}).`)
        console.error(err, err.stack);
        return {status: "error", message: err.message}
    } finally {
        try {
            if (db) {
                db.close();
            }
            if (tmpDir) {
                await rm(tmpDir, { recursive: true });
            }
        } catch (e) {
            console.error(`Error closing or removing sqlite db in ${tmpDir}.`, e);
        }
    }
}

async function lastUploadedSegmentTime(humanId, isRest) {
    const baseParams = {
        TableName: segmentsTable,
        KeyConditionExpression: "humanId = :humanId",
        FilterExpression: "isRest = :ir",
        ScanIndexForward: false,
        Limit: 1,
        ExpressionAttributeValues: { ":humanId": humanId, ":ir": isRest },
    };
    const dynResults = await docClient.query(baseParams).promise();
    if (dynResults.Items.length === 0) return 0;
  
    return dynResults.Items[0].endDateTime;
}

async function writeSegments(humanId, rows, isRest) {
    const putRequests = rows.map(r => {
        return {
            PutRequest: {
                Item: {
                    humanId: humanId,
                    endDateTime: r.end_date_time,
                    avgCoherence: r.avg_coherence,
                    stage: r.stage,
                    isRest: isRest
                }
            }
        };
    });
    
    // slice into arrays of no more than 25 PutRequests due to DynamoDB limits
    const chunks = [];
    for (let i = 0; i < putRequests.length; i += 25) {
        chunks.push(putRequests.slice(i, i + 25));
    }

    for (let i=0; i<chunks.length; i++) {
        const chunk = chunks[i];
        const params = { RequestItems: {} };
        params['RequestItems'][segmentsTable] = chunk;
        await docClient.batchWrite(params).promise();
    }
}