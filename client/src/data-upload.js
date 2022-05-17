import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from "@aws-sdk/client-cognito-identity"
import { createReadStream } from 'fs'
import { parse } from 'path'
import awsSettings from '../../common/aws-settings.json'
import ApiClient from '../../common/api/client.js'

let session;

function getS3Dest(subId, humanId, fileName) {
    const userDataBucket = awsSettings.UserDataBucket;
    return { bucket: userDataBucket, key: `${humanId}/${subId}/${fileName}`}
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
    /**
     * 
     * @param {Object} authSession CognitoAuthSession
     * @param {string} localFileSrc path on local file system to file to upload 
     * @param {Object} s3Dest Object with bucket and key members. If not provided will default to the UserDataBucket for the application and the key will be the user's own S3 path combined with the name of the local file.
     */
    async uploadFile(authSession, localFileSrc, s3Dest) {
        session = authSession;
        const {identityId, humanId} = await getUserIds();
        let bucket, key;
        if (!s3Dest || !s3Dest.hasOwnProperty('bucket') || !s3Dest.hasOwnProperty('key')) {
            const pathParts = parse(localFileSrc);
            ({bucket, key} = getS3Dest(identityId, humanId, pathParts.base));
        } else {
            bucket = s3Dest.bucket;
            key = s3Dest.key;
        }
        const s3Client = await getS3Client();
        const readStream = createReadStream(localFileSrc);
        const cmd = new PutObjectCommand({Bucket: bucket, Key: key, Body: readStream });
        const resp = await s3Client.send(cmd);
        if (resp.$metadata.httpStatusCode !== 200) {
            throw new Error(`Upload failed with status code ${resp.$metadata.httpStatusCode}`);
        }
    }
}


