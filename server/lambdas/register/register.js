import { CognitoIdentityProvider } from '@aws-sdk/client-cognito-identity-provider'
import { SES } from '@aws-sdk/client-ses'

import Db from 'db/db.js';
import awsSettings from "../../../common/aws-settings.json";

const AWS = require("aws-sdk");

const region = process.env.REGION;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const sesEndpoint = process.env.SES_ENDPOINT;
const emailSender = process.env.EMAIL_SENDER;

// get name, email that were used to sign consent form
const docClient = new AWS.DynamoDB.DocumentClient({
    endpoint: dynamoEndpoint,
    apiVersion: "2012-08-10",
    region: region,
});

const db = new Db();
db.docClient = docClient;

const ses = new SES({endpoint: sesEndpoint, region: region});


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

exports.sendEmails = async(event) => {
    let msgId;
    const failures = []; // 
    
        for (const r of event.Records) {
            try {
                msgId = r.messageId;
                const body = JSON.parse(r.body);
                await handleSQSMessage(body.envelopeId, body.email);
            } catch (err) {
                console.error(err);
                failures.push({itemIdentifier: msgId});
            }
        };
    
    return {batchItemFailures: failures};
}

async function handleSQSMessage(envelopeId, email) {
    if (await hasBeenEmailed(envelopeId)) return;
    if (await hasRegistered(email)) return;

    await sendEmail(envelopeId, email);
}

async function hasBeenEmailed(envelopeId) {
    const signingInfo = await db.getDsSigningInfo(envelopeId);
    if (signingInfo.Items.length != 1) throw new Error(`Expected to find one signing record for envelope ${envelopeId}, but found ${signingInfo.Items.length}`);

    return signingInfo.Items[0].emailed;
}

async function hasRegistered(email) {
    const user = await db.getUserByEmail(email);
    return Object.keys(user).length > 0;
}

const subject = 'HeartBEAM Study Next Steps';
const msgText = (envelopeId) => `Thank you for signing the HeartBEAM study consent form. 
The next step is to create an account on the HeartBEAM website so you can 
begin the study. Please do that by clicking this link: 
${awsSettings.RegistrationUri}?envelopeId=${envelopeId}`;

async function sendEmail(envelopeId, email) {
    await ses.sendEmail({
        Destination: {
            ToAddresses: [email]
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: msgText(envelopeId)
                },
                Text: {
                    Charset: "UTF-8",
                    Data: msgText(envelopeId)
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: subject
            }
        },
        Source: emailSender
    });

    await db.saveDsRegInstructionsSent(envelopeId);
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