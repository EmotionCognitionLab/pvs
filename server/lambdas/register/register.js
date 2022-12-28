import { CognitoIdentityProvider } from '@aws-sdk/client-cognito-identity-provider'

import Db from 'db/db.js';
import awsSettings from "../../../common/aws-settings.json";

const AWS = require("aws-sdk");

const region = process.env.REGION;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;

exports.signUp = async (event) => {
    try {
        // validate inputs
        const props = JSON.parse(event.body);
        const envelopeId = props.envelopeId;
        const password = props.password;
        const phone = props.phone;
        [envelopeId, password, phone].forEach(i => {
            if (!i || i.trim().length == 0) {
                return errResponse(400, "One or more required parameters are missing.");
            }
        });
        if (password.length < 12) {
            return errResponse(400, "Password must be at least 12 characters.")
        }
        if (phone.length != 12 || !phone.match(/\+1[\d]{10}/)) {
            return errResponse(400, "Phone number must be in the form +12135551212.");
        }

    
        // get name, email that were used to sign consent form
        const docClient = new AWS.DynamoDB.DocumentClient({
            endpoint: dynamoEndpoint,
            apiVersion: "2012-08-10",
            region: region,
        });
    
        const db = new Db();
        db.docClient = docClient;

        const signingInfo = await db.getDsSigningInfo(envelopeId);
        if (!signingInfo || signingInfo.Items.length != 1) {
            return errResponse(500, `No consent signature found for envelope id ${envelopeId}.`);
        }

        const name = signingInfo.Items[0].name;
        const email = signingInfo.Items[0].email;

        // call cognito to register user
        const client = new CognitoIdentityProvider({ region: region });
        const params = {
            ClientId: awsSettings.ClientId,
            ClientMetadata: {
                envelopeId: envelopeId
            },
            Username: email,
            Password: password,
            UserAttributes: [
                {
                    Name: "name",
                    Value: name
                },
                {
                    Name: "email",
                    Value: email
                },
                {
                    Name: "phone_number",
                    Value: phone
                }
            ]
        }

        await client.signUp(params);

        return {
            statusCode: 200,
            body: JSON.stringify({status: "success"}),
            headers: {
                "Access-Control-Allow-Origin": "*"
            }
        };
    } catch (err) {
        console.error(err);
        return errResponse(500, err.message);
    }
}

function errResponse(code, msg) {
    return {
        statusCode: code,
        body: msg,
        headers: {
            "Access-Control-Allow-Origin": "*"
        }
    }
}