
'use strict';

import SES from 'aws-sdk/clients/ses.js';
import SNS from 'aws-sdk/clients/sns.js';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(timezone);

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

const bloodDrawMessage = (huid, firstName) => {
    if (!huid || huid.trim() === "") throw new Error('Nonexistent or empty huid. Not sending blood draw survey for this recipient.');
    
    return {
        subject: "Tell us about your blood draw at your recent lab visit",
        html: `Hello ${firstName},<p>We'd like to hear about your experience with the blood draw at your recent lab visit for the HeartBEAM study. Please <a href="https://usc.qualtrics.com/jfe/form/SV_ebqB8UDgv1Ges3Y?huid=${huid}">click here</a> to complete a short survey.</p>`,
        text: `Hello ${firstName},\n\nWe'd like to hear about your experience with the blood draw at your recent lab visit for the HeartBEAM study. Please click here https://usc.qualtrics.com/jfe/form/SV_ebqB8UDgv1Ges3Y?huid=${huid} to complete a short survey.`
    };
}

const startTomorrowMsg = {
    subject: "Start the HeartBEAM Study Tomorrow!",
    html: "Hello, <p>Thank you so much again for joining the USC HeartBEAM Study! This is a friendly reminder that you are starting the study tomorrow. You will receive an email tomorrow with a link to log in to the study website (www.heartbeamstudy.org) to complete the first of 6 days of assessments. Please complete these over 6 consecutive days. As stated in the consent form, if you miss more than one out of 6 days of assessments, you will not be able to continue in the study.</p><p>Note: These assessments are designed to be challenging, so please do not worry if you find some of them difficult! We only ask that you do the best you can. :) Please let us know if you have any questions.</p><p>Best,</p><p>USC HeartBEAM Study Team</p>",
    text: "Hello,\n\nThank you so much again for joining the USC HeartBEAM Study! This is a friendly reminder that you are starting the study tomorrow. You will receive an email tomorrow with a link to log in to the study website (www.heartbeamstudy.org) to complete the first of 6 days of assessments. Please complete these over 6 consecutive days. As stated in the consent form, if you miss more than one out of 6 days of assessments, you will not be able to continue in the study.\n\nNote: These assessments are designed to be challenging, so please do not worry if you find some of them difficult! We only ask that you do the best you can. :) Please let us know if you have any questions.\n\nBest,\n\nUSC HeartBEAM Study Team",
    sms: "It's almost time to start the HeartBEAM study! Log in tomorrow at www.heartbeamstudy.org to complete Day 1 of 6 days of assessments."
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
    } else if (reminderType === 'bloodDrawSurvey') {
        await sendBloodDrawSurvey(commType);
    } else if (reminderType === 'startTomorrow') {
        await sendStartTomorrowReminders(commType);
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
                const now = dayjs().tz('America/Los_Angeles');
                // startDate is YYYY-MM-DD string
                const zonedStart = dayjs(u.startDate, 'YYYY-MM-DD').tz('America/Los_Angeles', true);
                if (zonedStart.isAfter(now)) continue;
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
            const todayStart = dayjs().tz('America/Los_Angeles').startOf('day').toDate();
            const todayEnd = dayjs().tz('America/Los_Angeles').endOf('day').toDate();
            const segments = await db.segmentsForUser(u.humanId, todayStart, todayEnd);
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

async function sendBloodDrawSurvey(commType) {
    if (commType !== "email") throw new Error(`The commType ${commType} is not supported for sending blood draw surveys.`);

    let sentCount = 0;

    try {
        const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
        const usersToMsg = await db.getBloodDrawUsers(yesterday);

        // we intentionally don't filter drops
        // even if they drop right after a blood draw
        // we still want to send the survey
        const sends = usersToMsg.map(async u => {
            await sendEmail(u.email, bloodDrawMessage(u.humanId, u.name.split(" ")[0]));
            sentCount++
        });
        await Promise.all(sends);
    } catch (err) {
        console.error(`Error sending blood draw surveys: ${err.message}`, err);
    }
    console.log(`Done sending ${sentCount} blood draw surveys.`);
}

async function sendStartTomorrowReminders(commType) {
    let sentCount = 0;

    try {
        const tomorrow = dayjs().tz('America/Los_Angeles').add(1, 'day').format('YYYY-MM-DD');
        const usersStartingTomorrow = await db.getUsersStartingOn(tomorrow);
        sentCount = await deliverReminders(usersStartingTomorrow, commType, startTomorrowMsg);
    } catch (err) {
        console.error(`Error sending ${commType} reminders to start tomorrow: ${err.message}`, err);
    }
    console.log(`Done sending ${sentCount} reminders to start tomorrow via ${commType}.`);
}

async function deliverReminders(recipients, commType, msg) {
    let sentCount = 0;
    let sends;

    const validRecipients = recipients.filter(r => !r.progress || (r.progress && !r.progress.dropped));

    if (commType === "email") {
        sends = validRecipients.map(async u => {
            await sendEmail(u.email, msg);
            sentCount++;
        });
    } else if (commType === "sms") {
        sends = validRecipients.filter(u => u.phone_number_verified).map(async u => {
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
    const todayYMD = dayjs().tz('America/Los_Angeles').format('YYYY-MM-DD');
    let setStartedToday = false;
    let setFinishedToday = false;
    sets.forEach(set => {
        const setDate = dayjs(set.dateTime).tz('America/Los_Angeles').format('YYYY-MM-DD');
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
