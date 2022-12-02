const AWS = require("aws-sdk");
const region = process.env.REGION;
const dynamoEndpoint = process.env.DYNAMO_ENDPOINT;
const docClient = new AWS.DynamoDB.DocumentClient({endpoint: dynamoEndpoint, apiVersion: "2012-08-10", region: region});
import Db from 'db/db.js';
import dayjs from 'dayjs';
import { earningsTypes } from '../../../common/types/types.js';

const db = new Db();
db.docClient = docClient;

export async function handler() {
    const users = await db.getBaselineCompleteUsers('pre');

    for (const u of users) {
        try {
            // pre-intervention baseline
            const preEarnings = await db.earningsForUser(u.userId, earningsTypes.PRE);
            if (preEarnings.length === 0) await saveBaselineEarnings(u.userId,  earningsTypes.PRE);

            // visits
            if (u.progress) {
                const visits = [1,2,3,4,5];
                for (const v of visits) {
                    const whichVisit = `visit${v}`;
                    if (u.progress[whichVisit]) await saveVisitEarnings(u.userId, whichVisit, u.progress[whichVisit].substring(0, 10));
                }
            }

            if (!u.homeComplete) {
                // lumosity practice + subsequent breathing session
                const lumosEarnings = await db.earningsForUser(u.userId,  earningsTypes.LUMOS_AND_BREATH_1);
                // should be sorted by date asc, so last should be most recent
                const lastLumosEarningsDate = lumosEarnings.length > 0 ? lumosEarnings.slice(-1)[0].date : '1970-01-01 00:00:00';
                if (!u.stage2Complete) {
                    await saveLumosAndBreathEarnings(u.userId, u.humanId, lastLumosEarningsDate, 2);
                } else {
                    await saveLumosAndBreathEarnings(u.userId, u.humanId, lastLumosEarningsDate, 3);
                }
            }

            // post-intervention baseline
            if (u.postComplete) {
                const postEarnings = await db.earningsForUser(u.userId, earningsTypes.POST);
                if (postEarnings.length === 0) await saveBaselineEarnings(u.userId, earningsTypes.POST);
            }
        } catch (err) {
            console.error(`Error calculating earnings for user ${u.userId}.`, err);
        }
    }
}

/**
 * Determine when the user completed their
 * pre- or post-intervention baseline tasks and save
 * their earnings for it for that date
 * @param {string} userId 
 * @param {string} preOrPost 'pre' or 'post'
 */
async function saveBaselineEarnings(userId, earningsType) {    
    const sets = await db.getSetsForUser(userId);
    const finalSetNum = earningsType === earningsTypes.PRE ? 6 :12;
    if (sets.length < finalSetNum) throw new Error(`Can't save ${earningsType} baseline earnings. Expected to find at least ${finalSetNum} set records, but found ${sets.length}.`);

    const setsDone = await db.getResultsForCurrentUser('set-finished', sets[0].identityId);
    const finalSets = setsDone.filter(s => s.results?.setNum === finalSetNum);
    if (finalSets.length !== 1) throw new Error(`Can't save ${earningsType} baseline earnings. Expected to find 1 set-finished record with setNum ${finalSetNum}, but found ${finalSets.length}.`);
    
    const finalSet = finalSets[0];
    const dateDone = finalSet.dateTime.substring(0, 10);
    await db.saveEarnings(userId, earningsType, dateDone);
}

/**
 * Saves earnings for a lab visit.
 * @param {string} userId 
 * @param {string} whichVisit "visit1", "visit2", etc.
 * @param {string} visitDate YYYY-MM-DD string
 */
async function saveVisitEarnings(userId, whichVisit, visitDate) {
    let earnType;
    switch (whichVisit) {
        case "visit1":
            earnType = earningsTypes.VISIT1;
            break;
        case "visit2":
            earnType = earningsTypes.VISIT2;
            break;
        case "visit3":
            earnType = earningsTypes.VISIT3;
            break;
        case "visit4":
            earnType = earningsTypes.VISIT4;
            break;
        case "visit5":
            earnType = earningsTypes.VISIT5;
            break;
        default:
            throw new Error(`Cannot save visit earnings for ${userId} - unrecognized visit earning type ${whichVisit}`);
    }
    await db.saveEarnings(userId, earnType, visitDate);
}

// check for lumosity activity since lastLumosEarningsDate and
// save any earnings from it (including bonuses) as well as from
// breathing exercises (including bonuses)
async function saveLumosAndBreathEarnings(userId, humanId, lastLumosEarningsDate, stage) {
    const lumosPlays = await db.lumosPlaysForUser(userId);

    // group lumos plays by day
    // dates are in YYYY-MM-DD HH:mm:ss format
    const lumosPlaysByDate = {};
    lumosPlays.forEach(lp => {
        const date = lp.dateTime.substring(0, 10);
        const plays = lumosPlaysByDate[date] || [];
        plays.push(lp);
        lumosPlaysByDate[date] = plays;
    });

    // calculate Lumosity bonuses
    // Lumosity bonuses are only done on Sunday and only apply once you have played 
    // at least one game/day for at least seven days (not necessarily consecutive)
    const today = new Date();
    if (today.getDay() == 0 && Object.keys(lumosPlaysByDate).length >= 7) {
        const weekAgo = dayjs(today).subtract(1, 'week').format('YYYY-MM-DD HH:mm:ss');
        // skip Penguin Pursuit and Word Bubbles; they don't have LPI scores
        const lpiGames = lumosPlays.filter(lp => lp.game !== 'Word Bubbles Web' && lp.game !== 'Penguin Pursuit Web');
        const prevGames = lpiGames.filter(lp => lp.dateTime < weekAgo);
        const thisWeekGames = lpiGames.filter(lp => lp.dateTime >= weekAgo);
        if (prevGames.length != 0 && thisWeekGames.length != 0) {
            const prevAvg = prevGames.reduce((prev, cur) => prev + cur.lpi, 0) / prevGames.length;
            const curAvg = thisWeekGames.reduce((prev, cur) => prev + cur.lpi, 0) / thisWeekGames.length;
            if (curAvg > prevAvg) await db.saveEarnings(userId, earningsTypes.LUMOS_BONUS, dayjs(today).format('YYYY-MM-DD'));
        }
    }
 
    // calculate lumosity payments
    const minSixLumosPlaysDates = Object.entries(lumosPlaysByDate)
    .filter(e => e[0] > lastLumosEarningsDate && e[1].length >= 6)
    .map(e => e[0]);
    
    // you only get paid for lumosity if you did a breathing practice afterward
    const breathSegs = await db.segmentsForUser(humanId);
    const breathSegsByDate = {};
    breathSegs.forEach(bs => {
        const date = dayjs(bs.endDateTime * 1000).format('YYYY-MM-DD');
        const segs = breathSegsByDate[date] || [];
        segs.push(bs);
        breathSegsByDate[date] = segs;
    });

    // stage 2 requires only one segment for payment
    // stage 3 requires three
    for (const d of minSixLumosPlaysDates) {
        if (!breathSegsByDate[d]) continue;
        if (stage == 2) await db.saveEarnings(userId, earningsTypes.LUMOS_AND_BREATH_1, d);
        if (stage == 3) {
            // you get $1 for lumos + one breathing session
            // and an additional $2 for a second breathing session
            if (breathSegsByDate[d].length >= 3) await db.saveEarnings(userId, earningsTypes.LUMOS_AND_BREATH_1, d);
            if (breathSegsByDate[d].length >= 6) await db.saveEarnings(userId, earningsTypes.BREATH2, d);
        }
    }

    // calculate breathing bonuses
    if (stage === 3) { 
        const stage3Segs = breathSegs.filter(bs => bs.stage === 3);
        
        if (stage3Segs.length < 9) return; // must have completed 3 15 minute sessions (=== 9 segments) to be eligible

        const breathBonusEarnings = await db.earningsForUser(userId, earningsTypes.BREATH_BONUS)
        const lastBreathBonusDate = breathBonusEarnings.length > 0 ? breathBonusEarnings.slice(-1)[0].date : '1970-01-01 00:00:00';
        const potentialBreathBonusDates = {};
        Object.entries(breathSegsByDate).forEach(e => {
            const filteredSegs = e[1].filter(bs => bs.stage === 3); // only stage 3 segments are eligible
            // only days with 6 segments ( === 30 min of breathing) are eligible
            if (e[0] > lastBreathBonusDate && filteredSegs.length >= 6) potentialBreathBonusDates[e[0]] = filteredSegs;
        });
        
        if (Object.keys(potentialBreathBonusDates).length > 0) await saveBreathBonusEarnings(userId, stage3Segs, potentialBreathBonusDates);
    }

}


/**
 * Calculates breath performance bonuses and saves them to the earnings table.
 * @param {Array} stage3Segs Array of segments as returned by db.segmentsForUser
 * @param {Object} potentialBreathBonusDates Object with YYYY-MM-DD as keys and array of segments from db.segmentsForUser as values
 */
async function saveBreathBonusEarnings(userId, stage3Segs, potentialBreathBonusDates) {
    for (const [date, segments] of Object.entries(potentialBreathBonusDates)) {
            if (segments.length == 0) continue;
            //segments should be sorted by endDateTime asc already, so first should be earliest for a given day
            const prevSegs = stage3Segs.filter(s => s.endDateTime < segments[0].endDateTime);
            if (prevSegs.length == 0) continue;
            const medianScore = median(prevSegs.map(s => s.avgCoherence));
            const avgSessScore = segments.reduce((prev, cur) => prev + cur.avgCoherence, 0) / segments.length;
            if (avgSessScore > medianScore) await db.saveEarnings(userId, earningsTypes.BREATH_BONUS, date);
    }
}

function median(arr) {
    if (arr.length == 0) throw new Error("Cannot calculate the median of an empty array");

    arr.sort((a, b) => a-b);
    const mid = Math.floor(arr.length / 2);
    if (mid % 2 !== 0) return arr[mid];

    return (arr[mid - 1] + arr[mid]) / 2;
}