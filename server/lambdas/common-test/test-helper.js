'use strict';

const path = require('path');
require('dotenv').config({path: path.join(__dirname, './env.sh')});
const AWS = require('aws-sdk');
const s3Client = new AWS.S3({endpoint: process.env.S3_ENDPOINT, apiVersion: '2006-03-01', s3ForcePathStyle: true});
const dynamoClient = new AWS.DynamoDB({endpoint: process.env.DYNAMO_ENDPOINT, apiVersion: '2012-08-10', region: process.env.REGION})

module.exports = {
    s3: {
        addFile: async (bucket, key, data) => {
            let bucketExists = false;
            try {
                await s3Client.headBucket({Bucket: bucket}).promise();
                bucketExists = true;
            } catch (err) {
                if (err.statusCode == 403) {
                    throw new Error(`Bucket ${bucket} already exists and you don't have permission to access it.`)
                }
            }
            try {
                if (!bucketExists) {
                    await s3Client.createBucket({Bucket: bucket}).promise();
                }
                await s3Client.putObject({Bucket: bucket, Key: key, Body:  Buffer.from(data)}).promise();
            } catch (err) {
                throw new Error(err);
            }
            
            
        },

        removeFile: async (bucket, key) => {
            try {
                await s3Client.deleteObject({Bucket: bucket, Key: key}).promise();
            } catch (err) {
                if (err.code !== 'NoSuchBucket') {
                    throw new Error(err);
                }
            }
        },

        removeBucket: async (bucket) => {
            try {
                const items = await s3Client.listObjectsV2({Bucket: bucket}).promise();
                if (items.Contents.length !== 0) {
                    const keys = items.Contents.map(i => ({ Key: i.Key}));
                    await s3Client.deleteObjects({Bucket: bucket, Delete: { Objects: keys }}).promise();
                }
                await s3Client.deleteBucket({Bucket: bucket}).promise();
            } catch (err) {
                if (err.code !== 'NoSuchBucket') { // ignore NoSuchBucket err - bucket should be gone and it is
                    throw new Error(err);
                }
            }
        }
    },
    
    dynamo: {
        createTable: async(tableName, keySchema, attributeDefinitions) => {
            await dynamoClient.createTable({
                TableName: tableName,
                KeySchema: keySchema,
                AttributeDefinitions: attributeDefinitions,
                ProvisionedThroughput: {
                    ReadCapacityUnits: 1,
                    WriteCapacityUnits: 1
                }
            }).promise();
            const waitMs = 1000;
            var retries = 3;
            var isActive = false;
            while (retries-- > 0 && !isActive) {
                try {
                    const tableStatus = await dynamoClient.describeTable({TableName: tableName}).promise();
                    isActive = tableStatus.Table.TableStatus === 'ACTIVE';
                } catch (err) {
                    if (err.code !== 'ResourceNotFoundException') {
                        // ignore ResourceNotFound, but nothing else
                        throw(err);
                    }
                } finally {
                    if (!isActive) {
                        await new Promise(r => setTimeout(r, waitMs));
                    }
                }
            }
            if (!isActive) {
                throw new Error(`Timed out trying to create table ${tableName}. Unable to confirm it is active.`);
            }
        },

        deleteTable: async(tableName) => {
            await dynamoClient.deleteTable({TableName: tableName}).promise();
        }
    }
};

