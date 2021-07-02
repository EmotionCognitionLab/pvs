/**
 * API for reading from and writing to the PVS DynamoDB database.
 */

 import awsSettings from '../../aws-settings.json';
 import AWS from 'aws-sdk/global';
 import DynamoDB from 'aws-sdk/clients/dynamodb';
 
 'use strict';
  
function saveResults(session, experiment, results) {
    const subId = getSubIdFromSession(session);
    const credentials = getCredentialsForSession(session);

    credentials.refresh(async err => {
        if (err) {
            throw new Error('Error refreshing credentials while saving exeperiment results', err);
        }
        const docClient = new DynamoDB.DocumentClient({region: awsSettings.AWSRegion, credentials: credentials});
        const params = {
            TableName: awsSettings.ExperimentTable,
            Item: {
                userDateTimeExperiment: `${subId}|${new Date().toISOString()}|${experiment}`,
                identityId: credentials.identityId,
                results: results
            }
        };
        await docClient.put(params).promise();
    });
}

async function getAllResultsForCurrentUser(session) {
    const credentials = getCredentialsForSession(session);

    try {
        await credentials.refreshPromise();
        const docClient = new DynamoDB.DocumentClient({region: awsSettings.AWSRegion, credentials: credentials});
        const params = {
            TableName: awsSettings.ExperimentTable,
            KeyConditionExpression: `identityId = :idKey`,
            ExpressionAttributeValues: { ':idKey': credentials.identityId }
        };
        const dynResults = await docClient.query(params).promise();
        const results = dynResults.Items.map(i => {
            const parts = i.userDateTimeExperiment.split('|');
            if (parts.length != 3) {
                throw new Error(`Unexpected userDateTimeExperiment value: ${i.userDateTimeExperiment}. Expected three parts, but found ${parts.length}.`)
            }
            const dateTime = parts[1];
            const experiment = parts[2];
            return {
                experiment: experiment,
                dateTime: dateTime,
                results: i.results
            }
        });
        return results;
    } catch (err) {
        throw new Error('Error refreshing credentials while fetching exeperiment results', err);
    }
}

function getCredentialsForSession(session) {
    const idToken = session.getIdToken().getJwtToken();
    const credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: awsSettings.IdentityPoolId,
        Logins: {
            [`cognito-idp.${awsSettings.AWSRegion}.amazonaws.com/${awsSettings.UserPoolId}`]: idToken
        }
    }, {region: awsSettings.AWSRegion});
    
    return credentials;
}

function getSubIdFromSession(session) {
    const idToken = session.getIdToken().getJwtToken();
    const payload = idToken.split('.')[1];
    const tokenobj = JSON.parse(atob(payload));
    return tokenobj['sub'];
}

export { saveResults, getAllResultsForCurrentUser }
