import Db from 'db/db.js';
import { docClient, sqsClient } from './aws-clients';
import awsSettings from "../../../common/aws-settings.json";

const sqsQueueUrl = process.env.REGISTRATION_SQS_QUEUE;

const badRequest = {
    statusCode: 400,
    body: "Malformed request",
    headers: {
        "Access-Control-Allow-Origin": "*"
    }
};

exports.signingDone = async(event) => {
    const isValid = (param) => (param && param.trim() !== "")
    for (const param of ["envelopeId", "name", "email"]) {
        if (!isValid(event.queryStringParameters[param])) return badRequest;
    };

    try {
        // save details to db
        const db = new Db();
        db.docClient = docClient;

        const envelopeId = event.queryStringParameters.envelopeId;
        const name = event.queryStringParameters.name;
        const email = event.queryStringParameters.email;
        await db.saveDsSigningInfo(envelopeId, name, email);

        // put message in SQS queue to trigger delayed email
        // with registration instructions if they don't
        // register immediately
        await sqsClient.sendMessage({
            QueueUrl: sqsQueueUrl,
            MessageBody: JSON.stringify({
                envelopeId: envelopeId,
                email: email
            })
        });

        // redirect user to registration
        const dest = `${awsSettings.RegistrationUri}?envelopeId=${envelopeId}`;
        return {
            statusCode: 302,
            headers: {
                Location: dest
            }
        };
    } catch (err) {
        console.error(err);
        throw(err);
    }
}

exports.getSigningInfo = async(event) => {
    const envelopeId = event.queryStringParameters.envelopeId;
    if (!envelopeId || envelopeId.trim() === "") return badRequest;

    try {
        const db = new Db();
        db.docClient = docClient;

        const results = await db.getDsSigningInfo(envelopeId);
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-type": "application/json"
            },
            body: JSON.stringify(results.Items)
        }
    } catch (err) {
        console.error(err);
        throw(err);
    }
}