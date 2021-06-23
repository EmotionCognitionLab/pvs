'use strict';

/**
 * Called by Cognito when a user verifies her account. Writes the 
 * user information from Cognito to Dynamo.
 **/

const AWS = require('aws-sdk');
const region = process.env.REGION;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const dynamo = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: '2012-08-10', region: region});

exports.handler = async (event) => {
    const userRec = buildUserRecord(event);
    try {
        await dynamo.put(userRec).promise();
        return event;
    } catch (err) {
        console.log(err);
        throw new Error('Something went wrong. Please try again later.') // NB this will be seen by the user
    }
};

function buildUserRecord(event) {
    let result = {
        TableName: usersTable,
        Item: {
            userId: event.request.userAttributes["sub"],
            name: event.request.userAttributes["name"],
            email: event.request.userAttributes["email"],
            phone_number: event.request.userAttributes["phone_number"],
            phone_number_verified: event.request.userAttributes["phone_number_verified"] === 'true',
            createdAt: new Date().toISOString()
        }
    };
    return result;
}