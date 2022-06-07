/**
 * API for reading from and writing to the PVS DynamoDB database.
 */

 import awsSettings from '../aws-settings.json';
 import AWS from 'aws-sdk/global.js';
 import DynamoDB from 'aws-sdk/clients/dynamodb.js';
 import { Logger } from "../logger/logger.js";
 import { getAuth } from "../auth/auth.js";
 
 'use strict';

export default class Db {
     constructor(options = {}) {
        this.region = options.region || awsSettings.AWSRegion;
        this.identityPoolId = options.identityPoolId || awsSettings.IdentityPoolId;
        this.userPoolId = options.userPoolId || awsSettings.UserPoolId;
        this.experimentTable = options.experimentTable || awsSettings.ExperimentTable;
        this.userExperimentIndex = options.userExperimentIndex || awsSettings.UserExperimentIndex;
        this.usersTable = options.usersTable || awsSettings.UsersTable;
        this.dsTable = options.dsTable || awsSettings.DsTable;
        this.session = options.session || null;
        if (!options.session) {
            this.docClient = new DynamoDB.DocumentClient({region: this.region});
        }
        this.logger = new Logger(false);
        this.isRefreshing = false; // credential/session refreshing flag
     }

     /**
      * Creates the dynamodb docclient using credentials built from the session.
      * Also sets this.subId to the subscriber id in the session.
      */
     set session(sess) {
         if (!sess) return;

        this.idToken = sess.getIdToken().getJwtToken();
        this.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: this.identityPoolId,
            Logins: {
                [`cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`]: this.idToken
            }
        }, {region: this.region});
        this.docClient = new DynamoDB.DocumentClient({region: this.region, credentials: this.credentials});
        this.subId = this.constructor.getSubIdFromSession(sess);
     }

     async saveResults(experiment, results, userId = null) {
        if (!this.subId && !userId) {
            throw new Error("You must provide either session or userId to save results.");
        }

        // if we have a subId (which is set when session is set) that overrides any passed-in userId
        const subscriberId = this.subId ? this.subId : userId;
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
                        userId: subscriberId,
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
            this.logger.error(err);
            throw err;
        }
            
    }

    async getResultsForCurrentUser(expName=null, identityId = null) {   
        if (!this.credentials && !identityId) {
            throw new Error("You must provide either session or identityId to get results for the current user");
        }

        const identId = await this.getValidCreds(identityId);

        try {
            let ExclusiveStartKey, dynResults
            let allResults = [];
    
            do {
                const params = {
                    TableName: this.experimentTable,
                    ExclusiveStartKey,
                    KeyConditionExpression: `identityId = :idKey`,
                    ExpressionAttributeValues: { ':idKey': identId }
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
            this.logger.error(err);
            throw err;
        }
    }

    async getAllResultsForCurrentUser() {
        return this.getResultsForCurrentUser();
    }
    
    async getExperimentResultsForCurrentUser(expName) {
        return this.getResultsForCurrentUser(expName);
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
                        identityId: i.identityId,
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
            this.logger.error(err);
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
            this.logger.error(err);
            throw err;
        }
    }

    async updateUser(userId, updates) {
        const disallowedAttrs = ['userId', 'createdAt', 'email', 'name', 'phone_number', 'phone_number_verified'];
        const expressionAttrVals = {};
        const expressionAttrNames = {};
        let updateExpression = 'set';
        for (const prop in updates) {
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
            this.logger.error(err);
            throw err;
        }
    }

    async getUser(userId, consistentRead=false) {
        const params = {
            TableName: this.usersTable,
            KeyConditionExpression: "userId = :idKey",
            ExpressionAttributeValues: { ":idKey": userId },
            ConsistentRead: consistentRead
        };
        const dynResults = await this.query(params);
        if (dynResults.Items.length === 0) {
            return {};
        }
        if (dynResults.Items.length > 1) {
            throw new Error(`Found multiple users with userId ${userId}.`);
        }
        return dynResults.Items[0];
    }

    async getIdentityIdForUserId(userId) {
        const baseParams = {
            TableName: this.experimentTable,
            IndexName: 'userId-experimentDateTime-index',
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {":userId": userId},
            ProjectionExpression: 'identityId'
        };
        const result = await this.query(baseParams);
        if (result.Items.length === 0) return null;
        return result.Items[0].identityId;
    }

    async getValidCreds(identityId=null) {
        // credentials override passed-in identity
        let identId = this.credentials ? this.credentials.identityId : identityId;
        if (!identId) {
            await this.refreshPermissions();
            identId = this.credentials ? this.credentials.identityId : identityId;
        }
        return identId;
    }

    async dynamoOp(params, fnName) {
        let curTry = 0;
        const maxTries = 3;
        let sleepTime = 200;
        while (curTry < maxTries) {
            try {
                if (this.isRefreshing) {
                    await new Promise(resolve => setTimeout(resolve, 1500)); // sleep to let the refresh happen
                }
                switch(fnName) {
                    case 'query':
                        return await this.docClient.query(params).promise();
                    case 'scan':
                        return await this.docClient.scan(params).promise();
                    case 'update':
                        return await this.docClient.update(params).promise();
                    case 'batchWrite': 
                        return await this.docClient.batchWrite(params).promise();
                    default:
                        throw new Error(`Unknown operation ${fnName}`);
                }
            } catch (err) {
                curTry++;
                if (err.code === 'ValidationException' ) {
                    this.logger.error(err);
                }
                if (err.code === 'CredentialsError' || err.code === 'ValidationException') { // ValidationException is usually a sign that this.credentials.identityId is empty
                    await this.refreshPermissions();
                } else {
                    this.logger.error(err);
                }
                // sleep before retrying
                await new Promise(resolve => setTimeout(resolve, sleepTime * curTry));
            }
        }
        this.logger.error(`Max tries exceeded. Dynamo op: ${fnName}. Parameters: ${JSON.stringify(params)}`);
    }

    async saveDsOAuthCreds(userId, accessToken, refreshToken, expiresAt) {
        const params = {
            TableName: this.dsTable,
            Key: { userId: userId },
            UpdateExpression: "set #accessToken = :accessToken, #refreshToken = :refreshToken, #expiresAt = :expiresAt",
            ExpressionAttributeNames: {
                "#accessToken": "accessToken",
                "#refreshToken": "refreshToken",
                "#expiresAt": "expiresAt"
            },
            ExpressionAttributeValues: {
                ":accessToken": accessToken,
                ":refreshToken": refreshToken,
                ":expiresAt": expiresAt
            }
        };
        console.log(params);
        try {
            const dynResults = await this.update(params);
            return dynResults.Items;
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    async query(params) {
        return this.dynamoOp(params, 'query');
    }

    async scan(params) {
        return this.dynamoOp(params, 'scan');
    }

    async update(params) {
        return this.dynamoOp(params, 'update');
    }

    async batchWrite(params) {
        return this.dynamoOp(params, 'batchWrite');
    }

    refreshSession() {
        return new Promise((resolve, reject) => {
            const auth = getAuth(session => resolve(session), err => reject(err));
            auth.getSession();
        });
    }

    async refreshPermissions() {
        if (this.isRefreshing) {
            this.logger.log('refreshPermissions called while refresh is already in progress; skipping');
            return;
        }

        try {
            this.isRefreshing = true;
            try {
                await this.credentials.getPromise();
            } catch (refreshErr) {
                if (refreshErr.code === 'NotAuthorizedException') {
                    this.session = await this.refreshSession();
                } else {
                    this.logger.error("Unexpected error refreshing credentials", refreshErr);
                }
            }
        } catch (err) {
            this.logger.error("Error trying to refresh permissions", err);
        } finally {
            this.isRefreshing = false;
        }
    }
}

Db.getSubIdFromSession = (session) => {
    const idToken = session.getIdToken().getJwtToken();
    const payload = idToken.split('.')[1];
    const tokenobj = JSON.parse(atob(payload));
    return tokenobj['sub'];
}
