import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.extend(timezone);

const baselineStatus = async (db, userId, preOrPost) => {
    if (preOrPost !== 'pre' && preOrPost !== 'post') throw new Error(`Expected 'pre' or 'post', but got '${preOrPost}'.`);

    // they're doing baseline training; check to see how many sets they've finished
    // and when they should have started doing sets
    const user = await db.getUser(userId);
    let started;
    if (preOrPost === 'pre') {
        started = user.startDate ? dayjs(user.startDate).tz('America/Los_Angeles', true).utc() : dayjs(user.createdAt);
    } else {
        started = dayjs(user.progress.visit5);
    } 
    const now = dayjs();
    const daysSinceStart = now.diff(started, 'day');
    const idId = await db.getIdentityIdForUserId(userId);

    // NB getFinishedSets is defined in participants.js :-(
    const sets = idId ? await db.getFinishedSets(idId) : [];

    const finishedSetsCount = sets.filter(s => {
        if (preOrPost === 'pre') return s.results.setNum <= 6;
        return s.results.setNum > 6;
        
    }).length;

    if (daysSinceStart <= 1) return {status: 'green', sets: `${finishedSetsCount}/6`};

    if (finishedSetsCount === 0) return {status: 'red', sets: '0/6'};

    if (daysSinceStart <= 3) {
        if (finishedSetsCount >= daysSinceStart - 1) return {status: 'green', sets: `${finishedSetsCount}/6`};
        return {status: 'yellow', sets: `${finishedSetsCount}/6`};
    }

    if (finishedSetsCount >= daysSinceStart - 1) return {status: 'green', sets: `${finishedSetsCount}/6`};
    if (finishedSetsCount >= daysSinceStart - 2) return {status: 'yellow', sets: `${finishedSetsCount}/6`};
    return {status: 'red', sets: `${finishedSetsCount}/6`};
}

// slightly misnamed, as they might not have started stage 2
// if they have not done stage 1, return 'gray' b/c they're waiting on a lab visit
// if they have done stage 1, see when they did it and return appropriate status
// based on how much lumosity they've played and how much breathing they've done
const stage2Status = async(db, userId, humanId) => {
    const segments = await db.segmentsForUser(humanId);
    if (segments.length === 0) return {status: 'gray'};

    const started = dayjs(segments[0].endDateTime * 1000); // segment times are seconds since the epoch, not ms
    const now = dayjs();
    const daysSinceStart = now.diff(started, 'day'); // will be 0 for all values <24h, 1 for <48h, etc.
    if (daysSinceStart <= 1) {
        return {status: 'green', lumosity: 'green', breathing: 'green'};
    }

    let breathStatus;
    const segsDone = segments.length - 1; // subtract 1 b/c we don't count the stage 1 segment
    if (daysSinceStart == 2 || daysSinceStart == 3) {
        if (segsDone >= daysSinceStart - 1) {
            breathStatus = 'green';
        } else {
            breathStatus = 'yellow';
        }
    } else {
        if (segsDone >= daysSinceStart - 1) {
            breathStatus = 'green';
        } else if (segsDone >= daysSinceStart - 2) {
            breathStatus = 'yellow';
        } else {
            breathStatus = 'red';
        }
    }

    const lumosStatus = await lumosityStatus(db, userId, daysSinceStart);
    if (lumosStatus === 'red' || breathStatus === 'red') return {status: 'red', lumosity: lumosStatus, breathing: breathStatus};
    if (lumosStatus === 'yellow' || breathStatus === 'yellow') return {status: 'yellow', lumosity: lumosStatus, breathing: breathStatus};
    return {status: 'green', lumosity: lumosStatus, breathing: breathStatus};
}

const stage3Status = async(db, userId, humanId, stage2CompletedOn) => {    
    let breathStatus;

    const started = dayjs(stage2CompletedOn);
    const now = dayjs();
    const daysSinceStart = now.diff(started, 'day'); // will be 0 for all values <24h, 1 for <48h, etc.
    const fiveDaysAgo = dayjs().subtract(5, 'days').toDate(); 

    const segsDone = (await db.segmentsForUser(humanId, fiveDaysAgo)).filter(s => s.stage === 3).length;
    const expectedSegsPerDay = 6;

    if (daysSinceStart <= 1) {
        return {status: 'green', lumosity: 'green', breathing: 'green'};
    }
    
    if (daysSinceStart == 2 || daysSinceStart == 3) {
        if (segsDone >= expectedSegsPerDay * (daysSinceStart - 1)) {
            breathStatus = 'green';
        } else {
            breathStatus = 'yellow';
        }
    } else {
        if (segsDone >= expectedSegsPerDay * 4) {
            breathStatus = 'green';
        } else if (segsDone >= expectedSegsPerDay * 3) {
            breathStatus = 'yellow';
        } else {
            breathStatus = 'red';
        }
    }

    const lumosStatus = await lumosityStatus(db, userId, daysSinceStart);
    if (lumosStatus === 'red' || breathStatus === 'red') return {status: 'red', lumosity: lumosStatus, breathing: breathStatus};
    if (lumosStatus === 'yellow' || breathStatus === 'yellow') return {status: 'yellow', lumosity: lumosStatus, breathing: breathStatus};
    return {status: 'green', lumosity: lumosStatus, breathing: breathStatus};
}

/**
 * Returns status of participant's lumosity plays as follows:
 * green: >=4 days with at least six games played per day in the past five days
 * yellow: 2-3 days with at least six games played per day in the past five days
 * red: <2 days with at least six games played per day in the past five days
 * @param {string} userId 
 */
const lumosityStatus = async(db, userId, daysSinceStart) => {
    if (daysSinceStart <= 1) return 'green';

    // subtract 6, rather than 5, b/c we will never have any lumosity data from today, 
    // so we go back one extra day to get five days of data
    const sixDaysAgo = dayjs().subtract(6, 'days').toDate(); 

    const lumosPlays = await db.lumosPlaysForUser(userId, sixDaysAgo);

    // group plays by day
    // dates are in YYYY-MM-DD HH:mm:ss format
    const byDate = {};
    lumosPlays.forEach(lp => {
        const date = lp.dateTime.substring(0, 10);
        const dateCount = byDate[date] || 0;
        byDate[date] = dateCount + 1;
    });

    const minSix = Object.entries(byDate).filter(e => e[1] >= 6).length;
    if (daysSinceStart == 2 || daysSinceStart == 3) {
        if (minSix < 2) return 'yellow';
        return 'green';
    }
    
    if (minSix >= 4) return 'green';
    if (minSix == 2 || minSix == 3) return 'yellow';
    if (minSix < 2) return 'red';
}

export {
    baselineStatus, stage2Status, stage3Status, lumosityStatus
}