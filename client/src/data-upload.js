import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from "@aws-sdk/client-cognito-identity"
import { createReadStream } from 'fs'
import { app } from 'electron'
import awsSettings from '../../common/aws-settings.json'
import { SessionStore } from './session-store.js'
import ApiClient from '../../common/api/client.js'
import Database from 'better-sqlite3'

let emWaveDbPath;
const userHome = app.getPath('home')
if (process.platform === 'darwin') {
    emWaveDbPath = userHome +  '/Documents/emWave/emWave.emdb';
} else if (process.platform === 'win32') {
    emWaveDbPath = userHome + '\\Documents\\emWave\\emWave.emdb';
} else {
    throw `The '${process.platform}' operating system is not supported. Please use either Macintosh OS X or Windows.`;
}

let session;

function getS3Dest(subId, humanId) {
    const userDataBucket = awsSettings.UserDataBucket;
    return { bucket: userDataBucket, key: `${humanId}/${subId}/emWave.emdb`}
}

function getIdToken() {
    return session.getIdToken().getJwtToken();
}

async function getIdentityId(idToken) {
    const logins =  { [`cognito-idp.${awsSettings.AWSRegion}.amazonaws.com/${awsSettings.UserPoolId}`]: idToken };
    const getIdInput = {
        IdentityPoolId: awsSettings.IdentityPoolId,
        Logins: logins
    };
    const cognitoClient = new CognitoIdentityClient({region: awsSettings.AWSRegion });
    const getIdCmd = new GetIdCommand(getIdInput);
    let identityId;
    try {
        identityId = (await cognitoClient.send(getIdCmd)).IdentityId;
    } catch (err) {
        console.error(err);
        throw(err);
    }

    return identityId;
}

async function getUserIds() {
    const idToken = getIdToken();
    const identityId = await getIdentityId(idToken);
    const apiClient = new ApiClient(session);
    const self = await apiClient.getSelf();
    const humanId = self.humanId;

    return { identityId: identityId, humanId: humanId };
}

async function getCredentials() {
    const cognitoClient = new CognitoIdentityClient({region: awsSettings.AWSRegion });
    let credentials;
    try {
        const idToken = getIdToken();
        const identityId = await getIdentityId(idToken);
        const logins =  { [`cognito-idp.${awsSettings.AWSRegion}.amazonaws.com/${awsSettings.UserPoolId}`]: idToken };
        const getCredsInput = {
            IdentityId: identityId,
            Logins: logins
        }
        const getCredsCmd = new GetCredentialsForIdentityCommand(getCredsInput);
        const cognitoCreds = await cognitoClient.send(getCredsCmd);
        credentials = cognitoCreds.Credentials;
    } catch (err) {
        console.error(err);
        throw(err);
    }

    return credentials;
}

async function getS3Client() {
    let s3Client = null;
    try {
        const credentials = await getCredentials();
        s3Client = new S3Client({region: awsSettings.AWSRegion, credentials: {
            accessKeyId: credentials.AccessKeyId,
            secretAccessKey: credentials.SecretKey,
            expiration: credentials.Expiration,
            sessionToken: credentials.SessionToken
        }});
    } catch (err) {
        console.error(err);
        throw(err);
    }

    return s3Client;
}

function deleteShortSessions() {
    const db = new Database(emWaveDbPath, {fileMustExist: true }) //nativeBinding: '../client/node_modules/better-sqlite3/build/Release/better_sqlite3.node'});
    try {
        const shortSessionLength = 4 * 60; // we delete all sessions less than or equal to 4 minutes long
        const stmt = db.prepare(`delete from Session where IBIEndTime - IBIStartTime <= ${shortSessionLength}`);
        stmt.run();
    } finally {
        db.close();
    }
}

/**
 * Returns the emWave SessionUuid, LiveIBI and EntrainmentParameter values for all sessions
 * since sinceDateTime. Excludes deleted and invalid sessions.
 * TODO: Break the data into five minute segements.
 * @param {Number} sinceDateTime date/time (in ms since the epoch) value for the earliest session to extract
 */
 function extractSessionData(sinceDateTime) {
    const db = new Database(emWaveDbPath, {fileMustExist: true })
    const results = [];
    try {
        const stmt = db.prepare(`select SessionUuid, LiveIBI, EntrainmentParameter from Session s where s.IBIStartTime >= ? and s.ValidStatus = 1 and s.DeleteFlag is null`);
        const sessions = stmt.all(sinceDateTime);
        for (let s of sessions) {
            const r = {sessionId: s.SessionUuid};

            const coherence = [];
            for (let i = 0; i<s.EntrainmentParameter.length; i+=4) {
                const b = new ArrayBuffer(4);
                const bytes = new Uint8Array(b);
                for (let j = 0; j<4; j++) {
                    bytes[j] = s.EntrainmentParameter[i+j];
                }
                const floatView = new Float32Array(b);
                coherence.push(Math.log(1 + floatView[0])); // coherence is ln(1 + entrainment param)
            }
            r['coherence'] = coherence;

            const liveIBI = [];
            for (let i = 0; i<s.LiveIBI.length; i+=2) {
                const b = new ArrayBuffer(2);
                const bytes = new Uint8Array(b);
                bytes[0] = s.LiveIBI[i];
                bytes[1] = s.LiveIBI[i+1];
                const intView = new Int16Array(b);
                liveIBI.push(intView[0]);
            }
            r['liveIBI'] = liveIBI;

            results.push(r);
        }
    } finally {
        db.close();
    }
    return results;
}

// returns the last modified date (in ms since start of epoch) of the object at the given bucket/ket
// returns 0 if the object isn't found
async function getLastUploadDate(s3Client, bucket, key) {
    const cmd = new HeadObjectCommand({Bucket: bucket, Key: key});
    const resp = await s3Client.send(cmd);
    if (resp.$metadata.httpStatusCode !== 200) {
        if (resp.$metadata.httpStatusCode === 404) {
            return 0;
        }
        throw new Error(`Getting last upload date failed with status code ${resp.$metadata.httpStatusCode}`);
    }
    const d = new Date(resp.LastModified);
    return d.getTime();
}

export default {
    async uploadEmWaveDb(serializedSession) {
        session = SessionStore.buildSession(serializedSession);
        deleteShortSessions();
        const {identityId, humanId} = await getUserIds();
        const {bucket, key} = getS3Dest(identityId, humanId);
        const s3Client = await getS3Client();
        const readStream = createReadStream(emWaveDbPath);
        const cmd = new PutObjectCommand({Bucket: bucket, Key: key, Body: readStream });
        const resp = await s3Client.send(cmd);
        if (resp.$metadata.httpStatusCode !== 200) {
            throw new Error(`Upload failed with status code ${resp.$metadata.httpStatusCode}`);
        }
    }
}


