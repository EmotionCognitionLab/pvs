'use strict';

/**
 * Called by Cognito when a user verifies her account. Writes the 
 * user information from Cognito to Dynamo.
 **/

const AWS = require('aws-sdk');
const fs = require("fs");
const path = require('path');

const region = process.env.REGION;
const usersTable = process.env.USERS_TABLE;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const dynamo = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: '2012-08-10', region: region});

// filtered WordNet 3.1 words
const adjs3 = fs.readFileSync(path.join(__dirname ,"wn3.1-adjs3.txt"), "utf8").trim().split("\n");
const adjs4 = fs.readFileSync(path.join(__dirname ,"wn3.1-adjs4.txt"), "utf8").trim().split("\n");
const nouns3 = fs.readFileSync(path.join(__dirname ,"wn3.1-nouns3.txt"), "utf8").trim().split("\n");
const nouns4 = fs.readFileSync(path.join(__dirname ,"wn3.1-nouns4.txt"), "utf8").trim().split("\n");

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

function capitalizeFirst(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function randomPhrase7() {
    // choose any adjective
    const i = Math.floor((adjs3.length+adjs4.length) * Math.random());
    const adj = i < adjs3.length ? adjs3[i] : adjs4[i-adjs3.length];
    // choose a noun from only those that will result in a phrase with length 7
    const validNouns = adj.length === 3 ? nouns4 : nouns3;
    const j = Math.floor(validNouns.length * Math.random())
    const noun = validNouns[j];
    return capitalizeFirst(adj) + capitalizeFirst(noun);
}

function buildUserRecord(event) {
    let result = {
        TableName: usersTable,
        Item: {
            userId: event.request.userAttributes["sub"],
            humanId: randomPhrase7(),
            name: event.request.userAttributes["name"],
            email: event.request.userAttributes["email"],
            phone_number: event.request.userAttributes["phone_number"],
            phone_number_verified: event.request.userAttributes["phone_number_verified"] === 'true',
            createdAt: new Date().toISOString()
        }
    };
    return result;
}