"use strict";

const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  region: process.env.AWSREGION,
  endpoint: process.env.S3_ENDPOINT
});
const simpleParser = require('mailparser').simpleParser;

const destBucket = process.env.DEST_BUCKET;
const destPrefix = process.env.DEST_PREFIX;


module.exports.saveattachments = async (event) => {
    // console.log('Received event:', JSON.stringify(event, null, 2));
    const record = event.Records[0];
    // Retrieve the email
    const request = {
      Bucket: record.s3.bucket.name,
      Key: record.s3.object.key,
    };
  
    try {
      const data = await s3.getObject(request).promise();
      const email = await simpleParser(data.Body);
      if (!email.attachments || email.attachments.length === 0) {
        console.log(`Email '${email.subject}' (s3 key: ${record.s3.object.key}) had no attachments.`);
        return { status: 'success' };
      }
      for (const a of email.attachments) {
        const d = new Date();
        const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}-${d.getHours().toString().padStart(2, '0')}-${d.getMinutes().toString().padStart(2, '0')}-${d.getSeconds().toString().padStart(2, '0')}-${d.getMilliseconds().toString().padStart(3, '0')}`
        const destKey = `${destPrefix}/${dateStr}.${a.filename}`;
        const params = {
          Body: a.content.toString(),
          Bucket: destBucket,
          Key: destKey
        };
        await s3.putObject(params).promise();
        return { status: 'success' };
      }
    } catch (err) {
      console.log(`Error trying to process email '${email.subject}' (s3 key: ${record.s3.object.key}).`)
      console.log(err, err.stack);
      throw(err);
    }
  };