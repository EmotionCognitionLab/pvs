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
                    experimentDateTimeUser: `${experiment}|${now}|${subId}|${idx}`,
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
        let ExclusiveStartKey, dynResults
        let allResults = [];

        do {
            const params = {
                TableName: awsSettings.ExperimentTable,
                ExclusiveStartKey,
                KeyConditionExpression: `identityId = :idKey`,
                ExpressionAttributeValues: { ':idKey': credentials.identityId }
            };
            dynResults = await docClient.query(params).promise();
            ExclusiveStartKey = dynResults.LastEvaluatedKey;
            const results = dynResults.Items.map(i => {
                const parts = i.experimentDateTimeUser.split('|');
                if (parts.length != 4) {
                    throw new Error(`Unexpected experimentDateTimeUser value: ${i.experimentDateTimeUser}. Expected four parts, but found ${parts.length}.`)
                }
                const experiment = parts[0];
                const dateTime = parts[1];
                // cognito sub id is parts[2]
                // index of result in original results list is parts[3] (exists only for uniqueness)
                return {
                    experiment: experiment,
                    dateTime: dateTime,
                    isRelevant: i.isRelevant,
                    results: i.results
                }
            });
            allResults = [...allResults, ...results];
        } while (dynResults.LastEvaluatedKey)
        
        return allResults.sort((r1, r2) => {
            if (r1.dateTime < r2.dateTime) {
                return -1
            }
            if (r1.dateTime > r2.dateTime) {
                return 1;
            }
            return 0;
        });
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
