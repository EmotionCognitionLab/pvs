/**
 * API for reading from and writing to the PVS DynamoDB database.
 */

 import cognitoSettings from '../../cognito-settings.json';
 import AWS from 'aws-sdk/global';
 import DynamoDB from 'aws-sdk/clients/dynamodb';
 
 'use strict';
  
function saveResults(session, experiment, results) {
    const idToken = session.getIdToken().getJwtToken();
    const payload = idToken.split('.')[1];
    const tokenobj = JSON.parse(atob(payload));
    const subId = tokenobj['sub'];

    const credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: cognitoSettings.IdentityPoolId,
        Logins: {
            [`cognito-idp.${cognitoSettings.AWSRegion}.amazonaws.com/${cognitoSettings.UserPoolId}`]: idToken
        }
    }, {region: cognitoSettings.AWSRegion});

    credentials.refresh(async err => {
        if (err) {
            throw new Error('Error refreshing credentials while saving exeperiment results', err);
        }
        const docClient = new DynamoDB.DocumentClient({region: cognitoSettings.AWSRegion, credentials: credentials});
        const params = {
            TableName: 'pvs-dev-experiment-data', // TODO exeternalize this
            Item: {
                userExperimentDateTime: `${subId}|${experiment}|${new Date().toISOString()}`,
                identityId: credentials.identityId,
                results: results
            }
        };
        await docClient.put(params).promise();
    });
}

export { saveResults }