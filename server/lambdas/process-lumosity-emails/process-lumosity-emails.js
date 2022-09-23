"use strict";

const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  region: process.env.AWSREGION,
  endpoint: process.env.S3_ENDPOINT,
  s3ForcePathStyle: true
});
const simpleParser = require('mailparser').simpleParser;
const dataForge = require('data-forge')

const destBucket = process.env.DEST_BUCKET;
const destPrefix = process.env.DEST_PREFIX;
const region = process.env.REGION;
const lumosAcctTable = process.env.LUMOS_ACCT_TABLE;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region});
import Db from '../../../common/db/db.js';


export async function saveattachments(event) {
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
      console.error(`Error trying to process email (s3 key: ${record.s3.object.key}).`)
      console.error(err, err.stack);
      throw(err);
    }
  };

export async function processreports(event) {
  
  const record = event.Records[0];
  // there are also daily engagement reports - we ignore those for now
  if (record && record.s3 && record.s3.object && record.s3.object.key && !record.s3.object.key.includes('game_result_report')) {
    return { status: 'ignored', reason: 'Missing file key or file is not a game result report.'};
  }

  const request = {
    Bucket: record.s3.bucket.name,
    Key: record.s3.object.key,
  };
  const db = new Db({lumosTable: lumosAcctTable, usersTable: usersTable});
  db.docClient = docClient;

  try {
    // retrieve the report
    const data = await s3.getObject(request).promise();

    // parse the data
    const playsData = lumosityGameResultsToPlaysByUserByGame(data.Body.toString());
  
    // walk through each lumos user and update corresponding row in our users table
    const distinctEmails = playsData.distinct(p => p.email).select(r => r.email);
    for (const email of distinctEmails) {
      const uid = await getUserIdForLumosEmail(email);
      if (!uid) {
        console.error(`Error: No user account found for lumosity player ${email}.`);
      } else {
        const playData = playsData.filter(r => r.email === email).select(row => {
          const res = {}
          res[row.game] = row.plays;
          return res;
        });
        await db.updateUser(uid, {lumosGames: playData.toArray()});
      }
    };

    return { status: 'success' };
  } catch (err) {
    console.error(`Error trying to process lumosity report (s3 key: ${record.s3.object.key})`)
    console.error(err, err.stack)
    throw(err)
  }
}

/**
 * Given CSV data from a lumosity game results report, returns a dataforge.DataFrame object with
 * 'email', 'game' and 'plays'. The "plays" value will be the total number of times that user
 * has played that game (ever).
 * @param {string} gameResultsCSV 
 * @returns {object} DataFrame with 'email', 'game' and 'plays' keys.
 */
function lumosityGameResultsToPlaysByUserByGame(gameResultsCSV) {
  const df = dataForge.fromCSV(gameResultsCSV)
    .parseInts('game_nth')
    .dropSeries(['user', 'username', 'activation_code', 'game', 'score', 'user_level', 'session_level', 'game_lpi']);

    const res = [];
    const byEmail = df.groupBy(row => row.email_address);
    for (const e of byEmail) {
        const emailAddr = e.first().email_address;
        const byGame = e.groupBy(r => r.game_name);
        for (const game of byGame) {
          const gameName = game.first().game_name;
          const maxNth = game.deflate(r => r.game_nth).max();
          res.push({email: emailAddr, game: gameName, plays: maxNth});
        }
    }

    return new dataForge.DataFrame(res);
}

async function getUserIdForLumosEmail(lumosEmail) {
  const baseParams = {
      TableName: lumosAcctTable,
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {":email": lumosEmail},
  };
  const dynResults = await docClient.query(baseParams).promise();
  if (dynResults.Items.length === 0) return null;

  if (dynResults.Items.length > 1) {
      throw new Error(`Found multiple lumosity accounts with email address ${lumosEmail}.`);
  }

  return dynResults.Items[0].owner;
}
