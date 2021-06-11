'use strict';

const path = require('path');
require('dotenv').config({path: path.join(__dirname, './env.sh')});
const AWS = require('aws-sdk');
const s3Client = new AWS.S3({endpoint: process.env.S3_ENDPOINT, apiVersion: '2006-03-01'});

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
    }
};

