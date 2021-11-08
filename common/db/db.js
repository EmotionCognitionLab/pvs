/**
 * API for reading from and writing to the PVS DynamoDB database.
 */

 import awsSettings from '../aws-settings.json';
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
                    experimentDateTime: `${experiment}|${now}|${idx}`,
                    identityId: credentials.identityId,
                    userId: subId,
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
            for (let i=0; i<chunks.length; i++) {
                const chunk = chunks[i];
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

async function getResultsForCurrentUser(session, expName=null) {
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
            if (expName !== null) {
                params.KeyConditionExpression += " and begins_with(experimentDateTime, :expName)";
                params.ExpressionAttributeValues[":expName"] = expName;
            }
            dynResults = await docClient.query(params).promise();
            ExclusiveStartKey = dynResults.LastEvaluatedKey;
            const results = dynResults.Items.map(i => {
                const parts = i.experimentDateTime.split('|');
                if (parts.length != 3) {
                    throw new Error(`Unexpected experimentDateTime value: ${i.experimentDateTime}. Expected three parts, but found ${parts.length}.`)
                }
                const experiment = parts[0];
                const dateTime = parts[1];
                // index of result in original results list is parts[2] (exists only for uniqueness)
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

async function getSetsForUser(userId) {
    try {
        const docClient = new DynamoDB.DocumentClient({region: process.env.AWSRegion});
        let ExclusiveStartKey, dynResults
        let allResults = [];

        do {
            const params = {
                TableName: process.env.ExperimentTable,
                IndexName: process.env.UserExperimentIndex,
                ExclusiveStartKey,
                KeyConditionExpression: 'userId = :userId and begins_with(experimentDateTime, :set)',
                ExpressionAttributeValues: { ':userId': userId, ':set': "set" },
            };
            dynResults = await docClient.query(params).promise();
            ExclusiveStartKey = dynResults.LastEvaluatedKey;
            const results = dynResults.Items.map(i => {
                const parts = i.experimentDateTime.split('|');
                if (parts.length != 3) {
                    throw new Error(`Unexpected experimentDateTime value: ${i.experimentDateTime}. Expected three parts, but found ${parts.length}.`)
                }
                const experiment = parts[0];
                const dateTime = parts[1];
                // index of result in original results list is parts[2] (exists only for uniqueness)
                return {
                    experiment: experiment,
                    dateTime: dateTime,
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

async function getBaselineIncompleteUsers(preOrPost) {
    let filter;

    if (preOrPost === 'pre') {
        filter = 'attribute_not_exists(preComplete) or preComplete = :f';
    } else if (preOrPost === 'post') {
        filter = 'attribute_not_exists(postComplete) or postComplete = :f';
    } else {
        throw new Error(`Expected preOrPost to be either 'pre' or 'post' but received "${preOrPost}".`);
    }

    try {
        const docClient = new DynamoDB.DocumentClient({region: process.env.AWSRegion});
            const params = {
                TableName: process.env.UsersTable,
                FilterExpression: filter,
                ExpressionAttributeValues: { ':f': false }
            };
        const dynResults = await docClient.scan(params).promise();
        return dynResults.Items;
        
    } catch (err) {
        console.error(err); // TODO implement remote error logging
        throw err;
    }
}

async function getAllResultsForCurrentUser(session) {
    return getResultsForCurrentUser(session);
}

async function getExperimentResultsForCurrentUser(session, expName) {
    return getResultsForCurrentUser(session, expName);
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

export { saveResults, getAllResultsForCurrentUser, getExperimentResultsForCurrentUser, getSetsForUser, getBaselineIncompleteUsers }
