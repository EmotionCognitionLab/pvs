"use strict";

const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  apiVersion: '2006-03-01',
  region: process.env.AWSREGION,
  endpoint: process.env.S3_ENDPOINT,
  s3ForcePathStyle: true
});
const simpleParser = require('mailparser').simpleParser;
const dataForge = require('data-forge');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const destBucket = process.env.DEST_BUCKET;
const destPrefix = process.env.DEST_PREFIX;
const region = process.env.REGION;
const lumosAcctTable = process.env.LUMOS_ACCT_TABLE;
const lumosPlaysTable = process.env.LUMOS_PLAYS_TABLE;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region});
import Db from '../../../common/db/db.js';


const allGames = [
  'Word Bubbles Web',
  'Memory Match Web',
  'Penguin Pursuit Web',
  'Color Match Web',
  'Raindrops Web',
  'Brain Shift Web',
  'Familiar Faces Web',
  'Pirate Passage Web',
  'Ebb and Flow Web',
  'Lost in Migration Web',
  'Tidal Treasures Web',
  'Splitting Seeds Web'
];

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
    console.log('Skipping - missing file key or file is not a game result report.')
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
  
    // walk through each lumos user and get their userId and other info
    const emails = playsData.distinct(p => p.email).select(r => r.email).toArray();
    const userInfoArr = [];
    for (const em of emails) {
      const userId = await getUserIdForLumosEmail(em);
      if (!userId) {
        console.error(`Error: no user account found for lumosity email ${em}.`);
      }
     
      const lastPlay = userId ? await lastPlayDate(userId) : '1970-01-01 00:00:00';
      const userInfo = userId ? await db.getUser(userId) : {};
      userInfoArr.push({email: em, userId: userId, lastPlay: lastPlay, stage2Completed: userInfo.stage2Completed});
    };
    
    const email2UserInfoMap = userInfoArr.reduce((prev, cur) => {
      prev[cur.email] = {userId: cur.userId, lastPlay: cur.lastPlay, stage2Completed: cur.stage2Completed};
      return prev;
    }, {});

    // find all the users that have new lumos data and save it to dynamo
    const newPlayData = playsData.filter(r => 
      email2UserInfoMap[r.email] && 
      email2UserInfoMap[r.email].userId &&
      r.dateTime > email2UserInfoMap[r.email].lastPlay
    )
    .map(r => {
        r.userId = email2UserInfoMap[r.email].userId;
        return r;
      }).toArray();
    if (newPlayData.length > 0) await savePlaysData(newPlayData);

    // find all the users who have a new stage2Completed status and save that to dynamo
    // stage2Completed is true when a user has played each of the available games at least twice
    // and has done a total of at least 31 plays
    const stage2StatusMap = {};
    for (const email of emails) {
      const forEmail = playsData.filter(r => r.email === email);
      let twoPlays = true;
      let totalPlays = 0;
      for (const game of allGames) {
          const playsForGame = forEmail.where(r => r.game === game).count();
          totalPlays += playsForGame;
          if (playsForGame < 2) {
              twoPlays = false;
              break;
          }
      }
      stage2StatusMap[forEmail.first().email] = twoPlays && totalPlays >= 31;
    }

    for (const [email, stage2Completed] of Object.entries(stage2StatusMap)) {
      if (stage2Completed && email2UserInfoMap[email].stage2Completed) continue;
      if (!stage2Completed && email2UserInfoMap[email].stage2Completed) {
        console.error(`Error: User ${email2UserInfoMap[email].userId} had previously completed stage 2 but now appears to not have completed it.`);
        continue;
      }
      if (stage2Completed && !email2UserInfoMap[email].stage2Completed) {
        const date = new Date();
        const today = dayjs(date).tz('America/Los_Angeles').format('YYYYMMDD');
        await db.updateUser(email2UserInfoMap[email].userId, {stage2Completed: true, stage2CompletedOn: today});
      }
    }

    return { status: 'success' };
  } catch (err) {
    console.error(`Error trying to process lumosity report (s3 key: ${record.s3.object.key})`)
    console.error(err, err.stack)
    throw(err)
  }
}

/**
 * Given CSV data from a lumosity game results report, returns a dataforge.DataFrame object with
 * 'email', 'game', 'dateTime', 'lpi' and 'multiPlay'. The 'multiPlay' value will be true if
 * the user played that game multiple times that day. The dateTime and lpi values will be for the
 * first play of the day in that case.
 * Some games lack LPI values. This returns 0 for the LPI in that case.
 * IMPORTANT: This method assumes that the lumosity report has records for each user in date order, 
 * which seems to be the case.
 * @param {string} gameResultsCSV 
 * @returns {object} DataFrame with 'email', 'game', 'dateTime', 'lpi' and 'multiPlay' keys.
 */
function lumosityGameResultsToPlaysByUserByGame(gameResultsCSV) {
  const df = dataForge.fromCSV(gameResultsCSV)
    .parseInts('game_nth')
    .dropSeries(['user', 'username', 'activation_code', 'game', 'score', 'user_level', 'session_level']);

    const res = [];
    const byEmail = df.groupBy(row => row.email_address);
    for (const e of byEmail) {
        const emailAddr = e.first().email_address;
        const byGame = e.groupBy(r => r.game_name);
        for (const game of byGame) {
          const gameName = game.first().game_name;
          const byDate = game.groupBy(r => dayjs(r.created_at).tz('America/Los_Angeles').format('YYYY-MM-DD'));
          for (const date of byDate) {
            const multiPlay = date.count() > 1;
            const lpi = date.first().game_lpi === '' ? 0 : Number.parseInt(date.first().game_lpi);
            res.push({email: emailAddr, game: gameName, dateTime: dayjs(date.first().created_at).tz('America/Los_Angeles').format('YYYY-MM-DD HH:mm:ss'), lpi: lpi, multiPlay: multiPlay});
          }
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

async function lastPlayDate(userId) {
  const baseParams = {
    TableName: lumosPlaysTable,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {":userId": userId},
    ScanIndexForward: false,
    Limit: 1
  };
  const dynResults = await docClient.query(baseParams).promise();
  if (dynResults.Items.length === 0) return '1970-01-01 00:00:00';

  return dynResults.Items[0].dateTime;
}

async function savePlaysData(data) {
  const putRequests = data.map(r => {
    return {
        PutRequest: {
            Item: {
                userId: r.userId,
                dateTime: r.dateTime,
                lpi: r.lpi,
                multiPlay: r.multiPlay,
                game: r.game
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
      params['RequestItems'][lumosPlaysTable] = chunk;
      await docClient.batchWrite(params).promise();
  }
}
