/**
 * API for reading from and writing to the PVS DynamoDB database.
 */

 import awsSettings from '../aws-settings.json';
 import AWS from 'aws-sdk/global';
 import DynamoDB from 'aws-sdk/clients/dynamodb';
 
 'use strict';

 export class Db {
     constructor(options = {}) {
        this.region = options.region || awsSettings.AWSRegion;
        this.identityPoolId = options.identityPoolId || awsSettings.IdentityPoolId;
        this.userPoolId = options.userPoolId || awsSettings.UserPoolId;
        this.experimentTable = options.experimentTable || awsSettings.ExperimentTable;
        this.userExperimentIndex = options.userExperimentIndex || awsSettings.UserExperimentIndex;
        this.usersTable = options.usersTable || awsSettings.UsersTable;
        this.session = options.session || null;
        this.credentials = this.session ? this.getCredentials() : null;
        this.docClient = this.credentials ? 
            new DynamoDB.DocumentClient({region: this.region, credentials: this.credentials}) :
            new DynamoDB.DocumentClient({region: this.region});
     }

     async saveResults(experiment, results, userId = null) {
        if (!this.session && !userId) {
            throw new Error("You must provide either session or userId to save results.");
        }

        let subId;
        // if we have a session the sub id from that overrides any passed in
        if (this.session) {
            subId = this.constructor.getSubIdFromSession(this.session);
        } else {
            subId = userId;
        }
        const now = new Date().toISOString();
    
        const putRequests = [];
        results.forEach((r, idx) => {
            const isRelevant = typeof r.isRelevant !== 'undefined' && r.isRelevant;
            delete(r.isRelevant);
            putRequests.push({
                PutRequest: {
                    Item: {
                        experimentDateTime: `${experiment}|${now}|${idx}`,
                        identityId: this.credentials.identityId,
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

        try {
            for (let i=0; i<chunks.length; i++) {
                const chunk = chunks[i];
                const params = { RequestItems: {} };
                params['RequestItems'][this.experimentTable] = chunk;
                await this.batchWrite(params);
            }
        } catch (err) {
            console.error(err); // TODO implement remote error logging
            throw err;
        }
            
    }

    async getResultsForCurrentUser(expName=null, identityId = null) {   
        if (!this.credentials && !identityId) {
            throw new Error("You must provide either session or identityId to get results for the current user");
        }

        try {
            let ExclusiveStartKey, dynResults
            let allResults = [];
    
            do {
                const params = {
                    TableName: this.experimentTable,
                    ExclusiveStartKey,
                    KeyConditionExpression: `identityId = :idKey`,
                    ExpressionAttributeValues: { ':idKey': this.credentials.identityId }
                };
                if (expName !== null) {
                    params.KeyConditionExpression += " and begins_with(experimentDateTime, :expName)";
                    params.ExpressionAttributeValues[":expName"] = expName;
                }
                dynResults = await this.query(params);
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

    async getAllResultsForCurrentUser() {
        return this.getResultsForCurrentUser();
    }
    
    async getExperimentResultsForCurrentUser(expName) {
        return this.getResultsForCurrentUser(expName);
    }

    getCredentials() {
        const idToken = this.session.getIdToken().getJwtToken();
        const credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: this.identityPoolId,
            Logins: {
                [`cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`]: idToken
            }
        }, {region: this.region});
        
        return credentials;
    }

    async getSetsForUser(userId) {
        try {
            let ExclusiveStartKey, dynResults
            let allResults = [];
    
            do {
                const params = {
                    TableName: this.experimentTable,
                    IndexName: this.userExperimentIndex,
                    ExclusiveStartKey,
                    KeyConditionExpression: 'userId = :userId and begins_with(experimentDateTime, :set)',
                    ExpressionAttributeValues: { ':userId': userId, ':set': "set" },
                };
                dynResults = await this.query(params);
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

    async getBaselineIncompleteUsers(preOrPost) {
        let filter;
    
        if (preOrPost === 'pre') {
            filter = 'attribute_not_exists(preComplete) or preComplete = :f';
        } else if (preOrPost === 'post') {
            filter = 'attribute_not_exists(postComplete) or postComplete = :f';
        } else {
            throw new Error(`Expected preOrPost to be either 'pre' or 'post' but received "${preOrPost}".`);
        }
    
        try {
            const params = {
                TableName: this.usersTable,
                FilterExpression: filter,
                ExpressionAttributeValues: { ':f': false }
            };
            const dynResults = await this.scan(params);
            return dynResults.Items;
            
        } catch (err) {
            console.error(err); // TODO implement remote error logging
            throw err;
        }
    }

    async updateUser(userId, updates) {
        disallowedAttrs = ['userId', 'createdAt', 'email', 'name', 'phone_number', 'phone_number_verified'];
        const expressionAttrVals = {};
        const expressionAttrNames = {};
        let updateExpression = 'set';
        for (prop in updates) {
            if (!disallowedAttrs.includes(prop) ) {
                const propName = `#${prop}`;
                const propVal = `:${prop}`
                expressionAttrNames[propName] = prop;
                expressionAttrVals[propVal] = updates[prop];
                updateExpression += ` ${propName} = ${propVal}`
            }
        }
        if (Object.keys(expressionAttrVals).length < 1) {
            throw new Error("You must provide an update to at least one allowed attribute.");
        }
        try {
            const params = {
                TableName: this.usersTable,
                Key: { userId: userId },
                UpdateExpression: updateExpression,
                ExpressionAttributeNames: expressionAttrNames,
                ExpressionAttributeValues: expressionAttrVals
            };
            const dynResults = await this.update(params);
            return dynResults.Items;
        } catch (err) {
            console.error(err); // TODO implement remote error logging
            throw err;
        }
    }

    async dynamoOp(dynamoFn, params, fnName) {
        let curTry = 0;
        const maxTries = 3;
        let sleepTime = 200;
        while (curTry < maxTries) {
            try {
                return await dynamoFn(params).promise();
            } catch (err) {
                curTry++;
                if (err.code === 'CredentialsError') {
                    this.credentials.refresh(async refreshErr => {
                        if (refreshErr) {
                            console.error(refreshErr);
                        }
                    });
                } else {
                    console.error(err);
                }
                // sleep before retrying
                await new Promise(resolve => setTimeout(resolve, sleepTime * curTry));
            }
        }
        console.error(`Max tries exceeded. Dynamo op: ${fnName}. Parameters: ${JSON.stringify(params)}`);
    }

    async query(params) {
        return this.dynamoOp(this.docClient.query.bind(this.docClient), params, 'query');
    }

    async scan(params) {
        return this.dynamoOp(this.docClient.scan.bind(this.docClient), params, 'scan');
    }

    async update(params) {
        return this.dynamoOp(this.docClient.update.bind(this.docClient), params, 'update');
    }

    async batchWrite(params) {
        return this.dynamoOp(this.docClient.batchWrite.bind(this.docClient), params, 'batchWrite');
    }

}

Db.getSubIdFromSession = (session) => {
    const idToken = session.getIdToken().getJwtToken();
    const payload = idToken.split('.')[1];
    const tokenobj = JSON.parse(atob(payload));
    return tokenobj['sub'];
}