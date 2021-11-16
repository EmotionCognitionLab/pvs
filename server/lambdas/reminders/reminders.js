
'use strict';

import SES from 'aws-sdk/clients/ses.js';
import SNS from 'aws-sdk/clients/sns.js';
import Db from 'db/db.js';

const sesEndpoint = process.env.SES_ENDPOINT;
const snsEndpoint = process.env.SNS_ENDPOINT;
const emailSender = process.env.EMAIL_SENDER;
const region = process.env.REGION;
const siteUrl = process.env.SITE_URL;

const preBaselineMsg = {
    subject: "Don't forget your daily brain challenge!",
    html: `Don't forget to do the brain challenges every day. Go to <a href="${siteUrl}">${siteUrl}</a> to do today's set.\n\nBest,\nYour HeartBEAM Team`,
    text: `Don't forget to do the brain challenges every day. Go to ${siteUrl} to do today's set.\n\nBest,\nYour HeartBEAM Team`,
    sms: `Don't forget to do the brain challenges every day. Go to ${siteUrl} to do today's set. - Your HeartBEAM Team`,
}

const ses = new SES({endpoint: sesEndpoint, apiVersion: '2010-12-01', region: region});
const sns = new SNS({endpoint: snsEndpoint, apiVersion: '2010-03-31', region: region});
const db = new Db();

export async function handler (event) {
    const commType = event.commType;
    if (commType !== "email" && commType !== "sms"){
        const errMsg = `A commType of either 'email' or 'sms' was expected, but '${commType}' was received.`;
        console.error(errMsg);
        throw new Error(errMsg);
    }

    await sendPreBaselineReminders(commType);
}

async function sendPreBaselineReminders(commType) {
    const usersToRemind = [];
    let sentCount = 0;
    let sends = [];

    try {
        const incompleteUsers = await db.getBaselineIncompleteUsers('pre');
        for (const u of incompleteUsers) {
            const sets = await db.getSetsForUser(u.userId);
            const baselineDone = await hasCompletedBaseline(sets);
            if (baselineDone) {
                // update the user record
                await db.updateUser(u.userId, {'preComplete': true});
            } else if (!hasDoneSetToday(sets)) {
                usersToRemind.push(u);
            }
        }
        
        if (commType === "email") {
            sends = usersToRemind.map(async u => {
                await sendEmail(u.email, preBaselineMsg);
                sentCount++;
            });
        } else if (commType === "sms") {
            sends = usersToRemind.filter(u => u.phone_number_verified).map(async u => {
                await sendSMS(u.phone_number, preBaselineMsg);
                sentCount++;
            });
        }
        await Promise.all(sends);

    } catch (err) {
        console.error(`Error sending ${commType} reminders for pre baseline tasks: ${err.message}`, err);
    }
    console.log(`Done sending ${sentCount} pre-baseline reminders via ${commType}.`);
}

async function hasCompletedBaseline(sets) {
    if (sets.length < 12) return false;
    // check to make sure that we have set-finished records
    // for all six sets
    const setsDone = await db.getResultsForCurrentUser('set-finished', sets[0].identityId);
    if (setsDone.length < 6) return false;
    const completedSetNums = setsDone.map(set => set.results.setNum).sort((elem1, elem2) => {
        if (elem1 == elem2) return 0;
        return elem1 < elem2 ? -1 : 1;
    });

    const expectedSetsDone = [1,2,3,4,5,6];
    return completedSetNums.every((val, idx) => val === expectedSetsDone[idx]);
}

function hasDoneSetToday(sets) {
    const now = new Date();
    const todayYMD = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, 0)}-${now.getDate().toString().padStart(2, 0)}`;
    let setStartedToday = false;
    let setFinishedToday = false;
    sets.forEach(set => {
        if (set.experiment === 'set-started' && set.dateTime.startsWith(todayYMD)) setStartedToday = true;
        if (set.experiment === 'set-finished' && set.dateTime.startsWith(todayYMD)) setFinishedToday = true;
    });

    return setStartedToday && setFinishedToday;
}


/**
 * Sends email message msg to a single recipient
 * @param {string} recip Email address of the recipient
 * @param {object} msg msg object with html, text, subject fields
 */
 async function sendEmail(recip, msg) {
    const params = {
        Destination: {
            ToAddresses: [recip]
        },
        Message: {
            Body: {
                Html: {
                    Charset: "UTF-8",
                    Data: msg.html
                },
                Text: {
                    Charset: "UTF-8",
                    Data: msg.text
                }
            },
            Subject: {
                Charset: "UTF-8",
                Data: msg.subject
            }
        },
        Source: emailSender
    }
    try {
        await ses.sendEmail(params).promise();
    } catch (err) {
        console.error(`Error sending email to ${recip}. (Message: ${msg.text})`, err);
    }
}

/**
 * Sends msg to one phone number.
 * @param {string} The e164 formatted phone number we're sending the message to 
 * @param {object} msg An object with an sms field containing the text we're sending
 */
 async function sendSMS(recip, msg) {
    const params = {
        Message: msg.sms,
        PhoneNumber: recip,
        MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
                DataType: 'String',
                StringValue: 'Transactional'
            }
        }
    }
    try {
        await sns.publish(params).promise();
    } catch (err) {
        console.error(`Error sending sms to ${recip}. (Message: ${msg.sms})`, err);
    }
}

export const forTesting = { hasCompletedBaseline, hasDoneSetToday };
