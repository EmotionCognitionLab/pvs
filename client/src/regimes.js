import { ipcMain } from 'electron';
import { getRegimeStats, getRegimeId, getAllRegimeIds, lookupRegime, getAvgRestCoherence, setRegimeBestCnt } from "./breath-data";

/**
 * Handles regime selection and generation.
 * A regime specifies a particular pattern of breathing that a user should follow.
 * It is defined by four characteristics: total duration (typically five minutes),
 * pace (a certain number of breaths per minute),
 * a “hold position” (whether a user should pause after inhalation, after exhalation or not at all),
 * and whether or not the breathing pace should be randomized.
 * A randomized regime varies the length of each inhalation, exhalation, and hold (if specified)
 * but does so in a way that over the course of the total duration the average number of breaths
 * per minute matches the pace specified for the regime. A non-randomized regime makes all
 * inhalations and exhalations (and holds, if specified) the same length.
 */

// potential subject conditions
const condA = 'a';
const condB = 'b';

// The static paces that participants will breathe at on various days
const defaultDurationMs = 5 * 60 * 1000;
const aPaces = [4,5,6];
const day1ARegimes = aPaces.map(p => {
    return {durationMs: defaultDurationMs, breathsPerMinute: p, randomize: false};
});
const day2ARegimes = aPaces.map(p => {
    return  {durationMs: defaultDurationMs, breathsPerMinute: p, hold: 'postInhale', randomize: false};
});
const day3And4ARegimes = [...day1ARegimes, ...day2ARegimes];

const bPaces = [10,12,15];
const day1BRegimes = bPaces.map(p => {
    return {durationMs: defaultDurationMs, breathsPerMinute: p, randomize: true};
});
const day2BRegimes = bPaces.map(p => {
    return {durationMs: defaultDurationMs, breathsPerMinute: p, hold: 'postInhale', randomize: true};
});
const day3And4BRegimes = [...day1BRegimes, ...day2BRegimes];

/**
 * Given a list of potential regimes, return a list of six regimes. (Unless there are no potential regimes,
 * in which case it returns an empty list.)
 * @param {Array} potentialRegimes Array of regimes 
 * @param {string} subjCondition The experimental conditon the subject is assigned to
 * @returns A list of six regimes or an empty list.
 */
 function pickRegimes(potentialRegimes, subjCondition) {
    if (subjCondition !== condA && subjCondition !== condB) {
        throw new Error(`Unexpected subject condition '${subjCondition}'. Expected either '${condA}' or '${condB}'.`);
    }

    if (potentialRegimes.length === 0) return [];

    if (potentialRegimes.length === 1) {
        if (subjCondition === condA) {
            const r = potentialRegimes[0];
            const bestTimes = r.is_best_cnt + 1;
            const newPaceDiff = 1 / (2 ** bestTimes);
            const newLowRegime = Object.assign({}, r);
            delete(newLowRegime.id);
            newLowRegime.breathsPerMinute -= newPaceDiff;
            const newHighRegime = Object.assign({}, r);
            delete(newHighRegime.id);
            newHighRegime.breathsPerMinute += newPaceDiff;
            r.is_best_cnt = bestTimes;

            // save new regimes + changes to old one
            setRegimeBestCnt(r.id, r.is_best_cnt);

            const highRegimeId = getRegimeId(newHighRegime);
            const lowRegimeId = getRegimeId(newLowRegime);
            newHighRegime.id = highRegimeId;
            newLowRegime.id = lowRegimeId;

            return arrayShuffle([newLowRegime, r, newHighRegime, newLowRegime, r, newHighRegime]);

        } else {
            return Array(6).fill(potentialRegimes[0], 6);
        }
    }

    if (potentialRegimes.length === 2) { // use both 3 times
        return arrayShuffle([...potentialRegimes, ...potentialRegimes, ...potentialRegimes]);
    }

    if (potentialRegimes.length === 3) { // use all 3 twice
        return arrayShuffle([...potentialRegimes, ...potentialRegimes]);
    }

    if (potentialRegimes.length >= 4) { // use what we have and if it's < 6 re-use random elems to get to 6
        let neededElems = potentialRegimes.length > 6 ? 6 : 6 - potentialRegimes.length;
        const res = potentialRegimes.length <= 6 ? [...potentialRegimes] : [];
        while (neededElems !== 0) {
            const randIdx = Math.floor(Math.random() * potentialRegimes.length);
            res.push(potentialRegimes.slice(randIdx, randIdx + 1)[0]);
            neededElems--;
        }
        return arrayShuffle(res);
    } 
}

function arrayShuffle(arr) {
    let curIdx = arr.length;
    let randIdx;

    while (curIdx !== 0) {
        randIdx = Math.floor(Math.random() * curIdx);
        curIdx--;

        [arr[curIdx], arr[randIdx]] = [arr[randIdx], arr[curIdx]];
    }
    return arr;
}

/**
 * Generates a list of six regimes that the user should breathe under for at-home training for the given day.
 * The regimes are fixed for days 1-4, and after that they are dynamic, so do not try to generate regimes in
 * advance (i.e., only generate day 5 after the participant has done days 1-4). Throws an error if it is
 * unable to generate six applicable regimes.
 * @param {string} subjCondition The experimental condition the subject is assigned to.
 * @param {number} dayCount The day of training the subject is on. (Days of completed training completed + 1, not calendar days.)
 * @returns A list of six regimes.
 */
function generateRegimesForDay(subjCondition, dayCount) {
    if (subjCondition !== condA && subjCondition !== condB) {
        throw new Error(`Unexpected subject condition '${subjCondition}'. Expected either '${condA}' or '${condB}'.`);
    }
    if (typeof(dayCount) !== 'number' || !Number.isInteger(dayCount) || dayCount < 1) {
        throw new Error(`Unexpected day of experiment '${dayCount}'. Should be an integer >= 1.`);
    }

    let regimes;
    if (dayCount === 1) {
        if (subjCondition === condA) {
            regimes = arrayShuffle([...day1ARegimes, ...day1ARegimes]);
        } else {
            regimes = arrayShuffle([...day1BRegimes, ...day1BRegimes]);
        }
    } else if (dayCount === 2) {
        if (subjCondition === condA) {
            regimes = arrayShuffle([...day2ARegimes, ...day2ARegimes]);
        } else {
            regimes = arrayShuffle([...day2BRegimes, ...day2BRegimes]);
        }
    } else if (dayCount === 3 || dayCount === 4) {
        if (subjCondition === condA) {
            regimes = arrayShuffle(day3And4ARegimes);
        } else {
            regimes = arrayShuffle(day3And4BRegimes);
        }
    } else {
        const allRegimes = getAllRegimeIds();
        const regimeStats = allRegimes.map(id => getRegimeStats(id));

        let targetAvgCoherence;
        if (subjCondition === condA) {
            targetAvgCoherence = Math.max(...(regimeStats.map(rs => rs.mean)));
        } else {
            targetAvgCoherence = getAvgRestCoherence();
        }
        const overlappingRegimes = regimeStats.filter(s => s.low95CI <= targetAvgCoherence && s.high95CI >= targetAvgCoherence);
        regimes = pickRegimes(overlappingRegimes.map(olr => lookupRegime(olr.id)), subjCondition);
        if (regimes.length === 0) {
            if (subjCondition === condA) {
                throw new Error('Found 0 possible regimes for training.');
            } else {
                // this is possible, though unlikely, in condition b
                console.warn('Found 0 possible regimes for training in condition b; picking regime with coherence closest to rest.');
                const closestToRest = regimeStats.reduce((prev, cur) => {
                    return Math.abs(cur.avg_coherence - targetAvgCoherence) < Math.abs(prev.avg_coherence - targetAvgCoherence) ? cur : prev;
                },
                {avg_coherence: Number.MAX_SAFE_INTEGER}
                );
                const closestRegime = lookupRegime(closestToRest.id);
                if (!closestRegime) {
                    throw new Error(`Expected to find regime with id ${closestToRest.id} but did not.`);
                } else {
                    regimes = Array(6).fill(closestRegime, 0);
                }
            }
        }
    }
    return regimes;
}

ipcMain.handle('calculate-regimes', (_event, subjCondition, dayCount) => {
    return generateRegimesForDay(subjCondition, dayCount);
});

export { generateRegimesForDay }

export const forTesting = { 
    condA,
    condB,
    day1ARegimes,
    day1BRegimes,
    day2ARegimes,
    day2BRegimes,
    day3And4ARegimes,
    day3And4BRegimes
}