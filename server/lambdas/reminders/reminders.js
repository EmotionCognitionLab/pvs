
'use strict';

import SES from 'aws-sdk/clients/ses.js';
import SNS from 'aws-sdk/clients/sns.js';
import { format, utcToZonedTime } from 'date-fns-tz';
import { isAfter } from 'date-fns';
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

const homeTrainingMsg = {
    subject: "A friendly reminder",
    html: "Have you done your training today? If you don't have time right now, put a reminder in your calendar to train later today.",
    text: "Have you done your training today? If you don't have time right now, put a reminder in your calendar to train later today.",
    sms: "Have you done your training today? If you don't have time right now, put a reminder in your calendar to train later today."
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

    const reminderType = event.reminderType;
    if (reminderType === 'preBaseline') {
        await sendPreBaselineReminders(commType);
    } else if (reminderType === 'homeTraining') {
        await sendHomeTraininingReminders(commType);
    } else {
        const errMsg = `A reminderType of either 'preBaseline' or 'homeTraining' was expected, but '${reminderType}' was received.`;
        console.error(errMsg);
        throw new Error(errMsg);
    }
}

async function sendPreBaselineReminders(commType) {
    const usersToRemind = [];
    let sentCount = 0;

    try {
        const incompleteUsers = await db.getBaselineIncompleteUsers('pre');
        for (const u of incompleteUsers) {
            if (u.startDate) {
                const now = utcToZonedTime(new Date(), 'America/Los_Angeles');
                // startDate is YYYY-MM-DD string
                const zonedStart = utcToZonedTime(new Date(u.startDate), 'America/Los_Angeles');
                if (isAfter(zonedStart, now)) continue
            }
            const sets = await db.getSetsForUser(u.userId);
            const baselineDone = await hasCompletedBaseline(sets);
            if (baselineDone) {
                // update the user record
                await db.updateUser(u.userId, {'preComplete': true});
            } else if (!hasDoneSetToday(sets)) {
                usersToRemind.push(u);
            }
        }
        
        sentCount = await deliverReminders(usersToRemind, commType, preBaselineMsg);

    } catch (err) {
        console.error(`Error sending ${commType} reminders for pre baseline tasks: ${err.message}`, err);
    }
    console.log(`Done sending ${sentCount} pre-baseline reminders via ${commType}.`);
}

async function sendHomeTraininingReminders(commType) {
    let sentCount = 0;
    const usersToRemind = [];

    try {
        const baselineDoneUsers = await db.getHomeTrainingInProgressUsers();
        for (const u of baselineDoneUsers) {
            const segments = await db.segmentsForUserAndDay(u.humanId, new Date());
            if (segments.length === 0) {
                usersToRemind.push(u);
                continue;
            }

            const stages = new Set(segments.map(s => s.stage));
            if (stages.size > 1) {
                // this shouldn't happen, since it implies they've done
                // multiple stages in the same day
                console.warn(`Exepcted to find only one stage for today for user ${u.userId}, but found `, stages);
            }
            // if there are multiples, use the latest (last) one
            const stagesArr = [...stages];
            const curStage = stagesArr[stagesArr.length - 1];

            // stage 1 is only one day long and stage 2 only has
            // one rest breathing segment per day, so if the stage is 1 or
            // 2 they don't get any reminders b/c they've obviously
            // already done everything for today
            if (curStage === 3 && segments.length < 6) {
                usersToRemind.push(u);
            }
        }

        sentCount = await deliverReminders(usersToRemind, commType, homeTrainingMsg);
    } catch (err) {
        console.error(`Error sending ${commType} reminders for home training tasks: ${err.message}`, err);
    }
    console.log(`Done sending ${sentCount} home training reminders via ${commType}.`);
}

async function deliverReminders(recipients, commType, msg) {
    let sentCount = 0;
    let sends;

    if (commType === "email") {
        sends = recipients.map(async u => {
            await sendEmail(u.email, msg);
            sentCount++;
        });
    } else if (commType === "sms") {
        sends = recipients.filter(u => u.phone_number_verified).map(async u => {
            await sendSMS(u.phone_number, msg);
            sentCount++;
        });
    }
    await Promise.all(sends);

    return sentCount;
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
    const todayYMD = format(new Date(), 'yyyy-MM-dd', { timezone: 'America/Los_Angeles' });
    let setStartedToday = false;
    let setFinishedToday = false;
    sets.forEach(set => {
        const setDate = format(new Date(set.dateTime), 'yyyy-MM-dd', { timeZone: 'America/Los_Angeles'});
        if (set.experiment === 'set-started' && setDate === todayYMD) setStartedToday = true;
        if (set.experiment === 'set-finished' && setDate === todayYMD) setFinishedToday = true;
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
