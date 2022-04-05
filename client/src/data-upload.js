import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from "@aws-sdk/client-cognito-identity"
import { createReadStream } from 'fs'
import { app } from 'electron'
import awsSettings from '../../common/aws-settings.json'
import { SessionStore } from './session-store.js'
import ApiClient from '../../common/api/client.js'

let emWaveDbPath
const userHome = app.getPath('home')
if (process.platform === 'darwin') {
    emWaveDbPath = userHome +  '/Documents/emWave/emWave.emdb';
} else if (process.platform === 'win32') {
    emWaveDbPath = userHome + '\\Documents\\emWave\\emWave.emdb';
} else {
    throw `The '${process.platform}' operating system is not supported. Please use either Macintosh OS X or Windows.`;
}

function getS3Dest(subId, humanId) {
    const userDataBucket = awsSettings.UserDataBucket;
    return { bucket: userDataBucket, key: `${humanId}/${subId}/emWave.emdb`}
}

function getIdToken() {
    if (SessionStore.session) return SessionStore.session.getIdToken().getJwtToken();
    throw new Error('You must log in to upload your data.');
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
    const apiClient = new ApiClient(SessionStore.session);
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

export default {
    async uploadEmWaveDb() {
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


