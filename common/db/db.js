/**
 * API for reading from and writing to the PVS DynamoDB database.
 */

 import awsSettings from '../aws-settings.json';
 import AWS from 'aws-sdk/global.js';
 import DynamoDB from 'aws-sdk/clients/dynamodb.js';
 import { Logger } from "../logger/logger.js";
 import { getAuth } from "../auth/auth.js";
 import { earningsTypes } from "../types/types.js";
 
 'use strict';

export default class Db {
     constructor(options = {}) {
        this.region = options.region || awsSettings.AWSRegion;
        this.identityPoolId = options.identityPoolId || awsSettings.IdentityPoolId;
        this.userPoolId = options.userPoolId || awsSettings.UserPoolId;
        this.earningsTable = options.earningsTable || awsSettings.EarningsTable;
        this.experimentTable = options.experimentTable || awsSettings.ExperimentTable;
        this.lumosAcctTable = options.lumosAcctTable || awsSettings.LumosAcctTable;
        this.lumosPlaysTable = options.lumosPlaysTable || awsSettings.LumosPlaysTable;
        this.userExperimentIndex = options.userExperimentIndex || awsSettings.UserExperimentIndex;
        this.usersTable = options.usersTable || awsSettings.UsersTable;
        this.dsTable = options.dsTable || awsSettings.DsTable;
        this.segmentsTable = options.segmentsTable || awsSettings.SegmentsTable;
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
        return await this.getUsersByBaselineStatus(preOrPost, 'incomplete');
    }

    async getBaselineCompleteUsers(preOrPost) {
        return await this.getUsersByBaselineStatus(preOrPost, 'complete');
    }

    async getUsersByBaselineStatus(preOrPost, status) {
        if (preOrPost !== 'pre' && preOrPost !== 'post') {
            throw new Error(`Expected preOrPost to be either 'pre' or 'post' but received "${preOrPost}".`);
        }

        if (status !== 'complete' && status !== 'incomplete') {
            throw new Error(`Expected status to be either 'complete' or 'incomplete' but received "${status}".`);
        }

        const preOrPostAttr = preOrPost === 'pre' ? 'preComplete' : 'postComplete'
        let filter;
        let attrValues;
        if (status === 'incomplete') {
            filter = `attribute_not_exists(${preOrPostAttr}) or ${preOrPostAttr} = :f`;
            attrValues = { ':f': false };
        } else {
            filter = `${preOrPostAttr} = :t`;
            attrValues = { ':t': true };
        }

        try {
            const params = {
                TableName: this.usersTable,
                FilterExpression: filter,
                ExpressionAttributeValues: attrValues
            };
            const dynResults = await this.scan(params);
            return dynResults.Items;
            
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    async getHomeTrainingInProgressUsers() {
        try {
            const params = {
                TableName: this.usersTable,
                FilterExpression: 'preComplete = :t and attribute_exists(progress.visit2) and (homeComplete = :f or attribute_not_exists(homeComplete))',
                ExpressionAttributeValues: {':t': true, ':f': false}
            };
            const dynResults = await this.scan(params);
            return dynResults.Items;
            
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    async getBloodDrawUsers(yyyymmddStr) {
        try {
            const params = {
                TableName: this.usersTable,
                FilterExpression: 'begins_with(progress.visit2, :ymdDate) or begins_with(progress.visit3, :ymdDate) or begins_with(progress.visit5, :ymdDate)',
                ExpressionAttributeValues: {':ymdDate': yyyymmddStr}
            };
            const dynResults = await this.scan(params);
            return dynResults.Items;
        } catch (err) {
            this.logger.error(err);
        }
    }

    async getUsersStartingOn(yyyyMMddStartDate) {
        try {
            const params = {
                TableName: this.usersTable,
                FilterExpression: 'startDate = :sd',
                ExpressionAttributeValues: {':sd': yyyyMMddStartDate}
            };
            const dynResults = await this.scan(params);
            return dynResults.Items;
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    async segmentsForUser(humanId, startDate = new Date(0), endDate = new Date(1000 * 60 * 60 * 24 * 365 * 1000)) {
        const startDateEpoch = Math.floor(startDate.getTime() / 1000);
        const endDateEpoch = Math.floor(endDate.getTime() / 1000);
        try {
            const params = {
                TableName: this.segmentsTable,
                KeyConditionExpression: 'humanId = :hId and endDateTime between :st and :et',
                ExpressionAttributeValues: { ':hId': humanId, ':st': startDateEpoch, ':et': endDateEpoch }
            };

            const results = await this.query(params);
            return results.Items;
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    async lumosPlaysForUser(userId, sinceDate = new Date(0)) {
        const sinceDateYYYYMMDD = `${sinceDate.getFullYear()}-${(sinceDate.getMonth() + 1).toString().padStart(2,0)}-${sinceDate.getDate().toString().padStart(2, 0)}`
        try {
            const params = {
                TableName: this.lumosPlaysTable,
                KeyConditionExpression: 'userId = :userId and #dateTime >= :dt',
                ExpressionAttributeNames: { '#dateTime': 'dateTime' },
                ExpressionAttributeValues: { ':userId': userId, ':dt': sinceDateYYYYMMDD },
            };

            const results = await this.query(params);
            return results.Items;
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    /**
     * Returns all rows between startDate and endDate where multiPlay is true
     * @param {string} startDate date in YYYY-MM-DD HH:mm:ss format (America/Los_Angeles timezone)
     * @param {string} endDate date in YYYY-MM-DD HH:mm:ss format (America/Los_Angeles timezone)
     */
    async lumosMultiPlays(startDate, endDate) {
        try {
            const params = {
                TableName: this.lumosPlaysTable,
                FilterExpression: '#dateTime >= :sdt and #dateTime <= :edt and multiPlay = :true',
                ExpressionAttributeNames: { '#dateTime': 'dateTime' },
                ExpressionAttributeValues: { ':sdt': startDate, ':edt': endDate, ':true': true }
            }

            const results = await this.scan(params);
            return results.Items;
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    async earningsForUser(userId, type = null) {
        try {
            const params =  {
                TableName: this.earningsTable,
                KeyConditionExpression: 'userId = :uid',
                ExpressionAttributeValues: {
                    ':uid': userId,
                }
            };
            if (type) {
                params.KeyConditionExpression += ' and begins_with(typeDate, :td)';
                params.ExpressionAttributeValues[':td'] = type;
            }

            const results = await this.query(params);
            return results.Items.map(i => {
                const parts = i.typeDate.split('|');
                if (parts.length !== 2) {
                    throw new Error(`Unexpected typeDate value: ${i.typeDate}. Expected two parts, but found ${parts.length}.`);
                }
                const type = parts[0];
                const date = parts[1];
                return {
                    userId: i.userId,
                    type: type,
                    date: date,
                    amount: i.amount
                };
            });
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
                updateExpression += ` ${propName} = ${propVal},`
            }
        }
        updateExpression = updateExpression.slice(0, -1); // drop the trailing comma
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

    async getUserByEmail(email) {
        const params = {
            TableName: this.usersTable,
            FilterExpression: "email = :email",
            ExpressionAttributeValues: { ":email": email }
        };
        const dynResults = await this.scan(params);
        if (dynResults.Items.length === 0) {
            return {};
        }
        if (dynResults.Items.length > 1) {
            throw new Error(`Found multiple users with email ${email}.`);
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

    async saveEarnings(userId, earningsType, date) {
        let amount;
        switch(earningsType) {
            case earningsTypes.PRE:
            case earningsTypes.POST:
                amount = 30;
                break;
            case earningsTypes.VISIT1:
            case earningsTypes.VISIT2:
            case earningsTypes.VISIT3:
            case earningsTypes.VISIT4:
            case earningsTypes.VISIT5:
                amount = 50;
                break;
            case earningsTypes.LUMOS_AND_BREATH_1:
            case earningsTypes.BREATH_BONUS:
                amount = 1;
                break;
            case earningsTypes.BREATH2:
            case earningsTypes.LUMOS_BONUS:
                amount = 2;
                break;
            default:
                throw new Error(`Unrecognized earnings type ${earningsType}.`);
        }
        const params = {
            TableName: this.earningsTable,
            Key: {
                userId: userId,
                typeDate: `${earningsType}|${date}`
            },
            UpdateExpression: `set amount = :amount`,
            ExpressionAttributeValues: { ':amount': amount }
        };
        await this.update(params);
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

    async saveDsSigningInfo(envelopeId, name, email) {
        const params = {
            TableName: this.dsTable,
            Key: { envelopeId: envelopeId },
            UpdateExpression: "set #name = :name, #email = :email, #dateTime = :dateTime",
            ExpressionAttributeNames: {
                "#name": "name",
                "#email": "email",
                "#dateTime": "dateTime"
            },
            ExpressionAttributeValues: {
                ":name": name,
                ":email": email,
                ":dateTime": (new Date()).toISOString()
            }
        };
        try {
            await this.update(params);
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    async getDsSigningInfo(envelopeId) {
        const params = {
            TableName: this.dsTable,
            KeyConditionExpression: `envelopeId = :envelopeId` ,
            ExpressionAttributeValues: { ":envelopeId": envelopeId }
        };
        try {
            return await this.query(params);
        } catch (err) {
            this.logger.error(err);
            throw err;
        }
    }

    async saveDsRegInstructionsSent(envelopeId) {
        const params = {
            TableName: this.dsTable,
            Key: { envelopeId: envelopeId },
            UpdateExpression: "set #emailed = :dateTime",
            ExpressionAttributeNames: {
                "#emailed": "emailed"            },
            ExpressionAttributeValues: {
                ":dateTime": (new Date()).toISOString()
            }
        }
        try {
            return await this.update(params);
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
