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
    const now = new Date().toISOString();

    const putRequests = [];
    results.forEach((r, idx) => {
        const isRelevant = typeof r.isRelevant !== 'undefined' && r.isRelevant;
        delete(r.isRelevant);
        putRequests.push({
            PutRequest: {
                Item: {
                    userDateTimeExperiment: `${subId}|${now}|${experiment}|${idx}`,
                    identityId: credentials.identityId,
                    results: r,
                    isRelevant: isRelevant
                }
            }
        });
    });

    // slice into arrays of no more than 25 PutRequests due to DynamoDB limits
    const chunks = [];
    for (let i = 0; i < putRequests.length; i += 25) {
        chunks.push(putRequests.slice(i, i + 25));
    }

    credentials.refresh(async err => {
        if (err) {
            // TODO implement remote error logging
            console.error('Error refreshing credentials while saving exeperiment results');
            console.error(err);
            throw err;
        }
        try {
            const docClient = new DynamoDB.DocumentClient({region: awsSettings.AWSRegion, credentials: credentials});
            for (const chunk of chunks) {
                const params = { RequestItems: {} };
                params['RequestItems'][awsSettings.ExperimentTable] = chunk;
                await docClient.batchWrite(params).promise();
            }
        } catch (err) {
            console.error(err); // TODO implement remote error logging
            throw err;
        }
        
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
            if (parts.length != 4) {
                throw new Error(`Unexpected userDateTimeExperiment value: ${i.userDateTimeExperiment}. Expected four parts, but found ${parts.length}.`)
            }
            // cognito sub id is parts[0]
            const dateTime = parts[1];
            const experiment = parts[2];
            // index of result in original results list is parts[3] (exists only for uniqueness)
            return {
                experiment: experiment,
                dateTime: dateTime,
                isRelevant: i.isRelevant,
                results: i.results
            }
        });
        return results;
    } catch (err) {
        console.error(err); // TODO implement remote error logging
        throw err;
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
