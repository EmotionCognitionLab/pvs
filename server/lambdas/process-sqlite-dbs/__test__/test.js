'use strict';

const path = require('path');
require('dotenv').config({path: path.join(__dirname, './env.sh')});
const th = require('../../common-test/test-helper.js');
import { readFile, mkdtemp, unlink } from 'fs/promises';
const os = require('os');
const lambdaLocal = require("lambda-local");
const AWS = require('aws-sdk');

const s3Client = new AWS.S3({endpoint: process.env.S3_ENDPOINT, apiVersion: '2006-03-01',
    s3ForcePathStyle: true});
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: process.env.DYNAMO_ENDPOINT, apiVersion: '2012-08-10', region: process.env.REGION});
const Database = require('better-sqlite3');

const theHumanId = 'RedInfo';
const sqliteKey = `${theHumanId}/us-west-2:1234567890abcdef/HartBeam.sqlite`;
let sqliteTestDbPath;

const segmentsTable = process.env.SEGMENTS_TABLE;

beforeEach(async () => {
    await th.dynamo.createTable(process.env.SEGMENTS_TABLE, 
        [{AttributeName: 'humanId', KeyType: 'HASH'}, {AttributeName: 'endDateTime', KeyType: 'RANGE'}], 
        [{AttributeName: 'humanId', AttributeType: 'S'}, {AttributeName: 'endDateTime', AttributeType: 'N'}]
    );
});

afterEach(async () => {
    await th.dynamo.deleteTable(process.env.SEGMENTS_TABLE);
});

const segments = [
    { session_start_time: 0, end_date_time: 3055000, avg_coherence: 0.458193283, stage: 3 },
    { session_start_time: 300000, end_date_time: 605000, avg_coherence: 1.773838, stage: 3 },
];

const restSegments = [
    { end_date_time: 2345950, avg_coherence: 1.084828, stage: 1 },
    { end_date_time: 7456929, avg_coherence: 0.2838411, stage: 2 }
];

describe("Processing a sqlite file", () => {
    let db;

    beforeAll(async () => {
        db = await initSqliteDb(db);
        await th.s3.removeBucket(process.env.DATA_BUCKET);
        const sqliteFile = await readFile(sqliteTestDbPath);
        await th.s3.addFile(process.env.DATA_BUCKET, sqliteKey, sqliteFile);
    });

    test("should load all segments", async() => {
        const result = await runS3PutLambda();
        expect(result.status).toBe('success');
        confirmResults(db, theHumanId, 0, false);
    });

    test("should load all rest segments", async() => {
        const result = await runS3PutLambda();
        expect(result.status).toBe('success');
        confirmResults(db, theHumanId, 0, true);
    });

    afterAll(async () => {
        await th.s3.removeBucket(process.env.DATA_BUCKET);

        if (db) {
            db.close();
        }
        unlink(sqliteTestDbPath);
    });

});

async function runS3PutLambda() {
    const putEventJson = await readFile(path.join(__dirname, 's3-put-event.json'));
    const putEvent = JSON.parse(putEventJson);
    putEvent.Records[0].s3.bucket.name = process.env.DATA_BUCKET;
    putEvent.Records[0].s3.object.key = sqliteKey;
    const result = await lambdaLocal.execute({
        event: putEvent,
        lambdaPath: path.join(__dirname, '../process-sqlite-dbs.js'),
        lambdaHandler: 'savesegments',
        verboseLevel: 0
    });
    return result;
}

async function confirmResults(db, humanId, lastUploadTime, isRest) {
    const sqlRows = getSqliteRows(db, lastUploadTime, isRest);
    const dynRows = await getDynamoRows(humanId, lastUploadTime, isRest);
    expect(dynRows.length).toBe(sqlRows.length);

    for (let i = 0; i < sqlRows.length; i++) {
        const sr = sqlRows[i];
        const dr = dynRows[i];
        expect(dr.avgCoherence).toBe(sr.avg_coherence);
        expect(dr.stage).toBe(sr.stage);
        expect(dr.endDateTime).toBe(sr.end_date_time);
        expect(dr.humanId).toBe(humanId);
    }
}

async function initSqliteDb() {
    const dbDir = await mkdtemp(os.tmpdir());
    sqliteTestDbPath = path.join(dbDir, 'TestHeartBEAM.sqlite');
    const db = new Database(sqliteTestDbPath);

    const createSegmentTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS segments(id INTEGER PRIMARY KEY, session_start_time INTEGER NOT NULL, end_date_time INTEGER NOT NULL, avg_coherence FLOAT, stage INTEGER NOT NULL)');
    createSegmentTableStmt.run();
    const insertSegmentStmt = db.prepare('INSERT INTO segments(session_start_time, end_date_time, avg_coherence, stage) VALUES(?, ?, ?, ?)');
    segments.forEach(s => insertSegmentStmt.run(s.session_start_time, s.end_date_time, s.avg_coherence, s.stage));

    // a rest segment is one in which a subject breathes at whatever pace they like
    // while sitting quietly
    const createRestSegmentsTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS rest_segments(id INTEGER PRIMARY KEY, end_date_time INTEGER NOT NULL, avg_coherence FLOAT, stage INTEGER NOT NULL)');
    createRestSegmentsTableStmt.run();
    const insertRestSegmentStmt = db.prepare('INSERT INTO rest_segments(end_date_time, avg_coherence, stage) VALUES(?, ?, ?)');
    restSegments.forEach(rs => insertRestSegmentStmt.run(rs.end_date_time, rs.avg_coherence, rs.stage));

    return db;
}

function getSqliteRows(db, lastUploadTime, isRest) {
    const table = isRest ? 'rest_segments' : 'segments';
    const query = `select * from ${table} where end_date_time > ? order by end_date_time asc`;
    const stmt = db.prepare(query);
    return stmt.all(lastUploadTime);
}

async function getDynamoRows(humanId, lastUploadTime, isRest) {
    const userQueryRes = await docClient.scan({
        TableName: segmentsTable, 
        FilterExpression: "humanId = :humanId and endDateTime > :lut and isRest = :ir",
        ExpressionAttributeValues: {":humanId": humanId, ":lut": lastUploadTime, ":ir": isRest},
    }).promise();
    return userQueryRes.Items;
}
