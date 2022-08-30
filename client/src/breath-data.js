import { app, ipcMain } from 'electron';
import { statSync } from 'fs';
import { mkdir } from 'fs/promises';
import { mean, std } from 'mathjs';
import { camelCase, zipObject } from 'lodash'
import emwave from './emwave.js';
import Database from 'better-sqlite3';
import s3utils from './s3utils.js'
import { SessionStore } from './session-store.js'
import { yyyymmddNumber } from './utils.js';
import * as path from 'path'

let db;
let insertSegmentStmt, insertRestSegmentStmt, findRegimeStmt, insertRegimeStmt, regimeByIdStmt;

function breathDbPath() {
   return path.join(breathDbDir(), 'HeartBEAM.sqlite');
}

function breathDbDir() {
    let breathDbDir;

    const userHome = app.getPath('home');
    if (process.platform === 'darwin') {
        breathDbDir = userHome +  '/Documents/HeartBEAM/';
    } else if (process.platform === 'win32') {
        breathDbDir = userHome + '\\Documents\\HeartBEAM';
    } else {
        throw `The '${process.platform}' operating system is not supported. Please use either Macintosh OS X or Windows.`;
    }

    return breathDbDir;

}


async function downloadDatabase(dest, session) {
    const resp = await s3utils.downloadFile(session, dest);
    if (resp.status === 'Error') {
        console.error('Failed to download breath database from s3.');
        throw new Error(resp.msg);
    }
}

function getRegimeId(regime) {
    const holdPos = regime.holdPos ? regime.holdPos : null;
    const randomizedAsInt = regime.randomize ? 1 : 0;
    const existing = findRegimeStmt.get(regime.durationMs, regime.breathsPerMinute, holdPos, randomizedAsInt);
    if (existing) return existing.id;

    const newRegime = insertRegimeStmt.run(regime.durationMs, regime.breathsPerMinute, holdPos, randomizedAsInt);
    if (newRegime.changes !== 1) {
        throw new Error(`Error adding regime ${JSON.stringify(regime)} . Expected it to add one row, but it added ${newRegime.changes}.`);
    }
    return newRegime.lastInsertRowid;
}

function lookupRegime(regimeId) {
    const res = regimeByIdStmt.get(regimeId);
    if (!res) return;

    return regimeDataToRegime(res);
}

function createSegment(regimeData) {
    const endDateTime = Math.round((new Date).getTime() / 1000);
    let newSegment;
    if (!regimeData.regime) {
        // then it's a rest segment
        newSegment = insertRestSegmentStmt.run(endDateTime, regimeData.avgCoherence);
    } else {
        const regimeId = getRegimeId(regimeData.regime);
        newSegment = insertSegmentStmt.run(
            regimeId,
            regimeData.sessionStartTime,
            endDateTime,
            regimeData.avgCoherence
        );
    }
    
    if (newSegment.changes !== 1) {
        throw new Error(`Error adding segment with start time ${regimeData.sessionStartTime}`);
    }
    return newSegment.lastInsertRowid;
}

function getSegmentsAfterDate(date) {
    const stmt = db.prepare('SELECT * FROM segments where end_date_time >= ? ORDER BY end_date_time asc');
    const res = stmt.all(date.getTime() / 1000);
    return res.map(rowToObject);
}

function getTrainingDays(useRest, includeToday) {
    const tableName = useRest ? 'rest_segments': 'segments';
    let segEndTimes = [];
    if (includeToday) {
        const stmt = db.prepare(`SELECT end_date_time FROM ${tableName}`);
        segEndTimes = stmt.all();
    } else {
        const stmt = db.prepare(`SELECT end_date_time FROM ${tableName} where end_date_time < ?`);
        const startOfDay = new Date();
        startOfDay.setHours(0); startOfDay.setMinutes(0); startOfDay.setSeconds(0);
        segEndTimes = stmt.all(startOfDay.getTime() / 1000);
    }

    const uniqDays = new Set(segEndTimes.map(s => {
        const theDate = new Date(s.end_date_time * 1000);
        return yyyymmddNumber(theDate);
    }));

    return uniqDays;
}

/**
 * Returns the number of days, not including today, that a user
 * has done at least one breathing segment.
 */
function getTrainingDayCount() {
    const uniqDays = getTrainingDays(false, false);
    return uniqDays.size;
}

function getAvgCoherenceValues(regimeId) {
    const stmt = db.prepare('SELECT avg_coherence from segments where regime_id = ?');
    const res = stmt.all(regimeId);
    return res.map(r => r.avg_coherence);
}

function getRegimeStats(regimeId) {
    const avgCohVals = getAvgCoherenceValues(regimeId);
    const stdDev = std(avgCohVals);
    const interval = 1.96 * stdDev;
    const meanAvgCoh = mean(avgCohVals);
    return { id: regimeId, mean: meanAvgCoh, low95CI: meanAvgCoh - interval, high95CI: meanAvgCoh + interval};
}

function getAllRegimeIds() {
    const allRegimesStmt = db.prepare('SELECT id from regimes');
    const allRegimes = allRegimesStmt.all();
    return allRegimes.map(r => r.id);
}

function getAvgRestCoherence() {
    const stmt = db.prepare('SELECT avg_coherence from rest_segments');
    const res = stmt.all();
    return mean(res.map(r => r.avg_coherence));
}

/**
 * @return {Set}  Set of days (as YYYYMMDD numbers) that rest breathing has been done on
 */
function getRestBreathingDays() {
    return getTrainingDays(true, true);
}

function setRegimeBestCnt(regimeId, count) {
    const updateStmt = db.prepare('UPDATE regimes set is_best_cnt = ? where id = ?');
    const res = updateStmt.run(count, regimeId);
    if (res.changes != 1) {
        throw new Error(`Error updating is_best_cnt for regime ${regimeId}. Expected it to update one row, but it updated ${res.changes}.`);
    }
}

function rowToObject(result) {
    const rowProps = Object.keys(result).map(camelCase);
    const rowVals = Object.values(result);
    return zipObject(rowProps, rowVals);
}

function regimeDataToRegime(rd) {
    const resObj = rowToObject(rd);
    resObj.randomize = rd.randomize === 0 ? false : true;
    return resObj;
}

/**
 * Returns the regimes the user is supposed to follow for a given day, or
 * an empty list if none are found.
 * @param {Date} date
 */
function getRegimesForDay(date) {
    const regimesForDayStmt = db.prepare('SELECT regimes.* FROM regimes JOIN daily_regimes ON regimes.id = daily_regimes.regime_id WHERE daily_regimes.date = ? ORDER BY daily_regimes.day_order ASC');
    const yyyymmdd = yyyymmddNumber(date);
    const res = regimesForDayStmt.all(yyyymmdd);
    return res.map(regimeDataToRegime);
}

/**
 * Saves the given regimes as the ones to use for the given day.
 * When retrieved they will always be returned in the order they had here.
 * @param {array} regimes 
 * @param {Date} date 
 */
function saveRegimesForDay(regimes, date) {
    const stmt = db.prepare('INSERT INTO daily_regimes(regime_id, date, day_order) VALUES(?, ?, ?)');
    const yyyymmdd = yyyymmddNumber(date);
    regimes.forEach((r, idx) => {
        const id = r.id ? r.id : getRegimeId(r);
        stmt.run(id, yyyymmdd, idx);
    });
}

// import this module into itself so that we can mock
// certain calls in test
// https://stackoverflow.com/questions/51269431/jest-mock-inner-function
import * as testable from "./breath-data.js";
async function initBreathDb(serializedSession) {
    try {
        statSync(testable.breathDbPath());
    } catch (err) {
        if (err.code !== 'ENOENT') throw(err);
        // create directory (call is ok if dir already exists)
        await mkdir(testable.breathDbDir(), { recursive: true });

        // we have no local db file; try downloading it
        const session = SessionStore.buildSession(serializedSession);
        await testable.forTesting.downloadDatabase(testable.breathDbPath(), session);
    }

    try {
        // at this point if we don't have a db
        // then either it's a new user or we've
        // lost all their data :-(
        // either way, we can let sqlite create the database
        // if necessary
        db = new Database(testable.breathDbPath());
        const createRegimeTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS regimes(id INTEGER PRIMARY KEY, duration_ms INTEGER NOT NULL, breaths_per_minute INTEGER NOT NULL, hold_pos TEXT, randomize BOOLEAN NOT NULL, is_best_cnt INTEGER NOT NULL DEFAULT 0)');
        createRegimeTableStmt.run();

        const createDailyRegimesTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS daily_regimes(id INTEGER PRIMARY KEY, regime_id INTEGER NOT NULL, date INTEGER NOT NULL, day_order INTEGER NOT NULL, FOREIGN KEY(regime_id) REFERENCES regimes(id))');
        createDailyRegimesTableStmt.run();

        // a segment is a portion (usually five minutes) of a longer emwave session (usually fifteen minutes) 
        // during which breathing happens under a given regime
        // a segment is eseentially an instance of a regime - while participants may breathe
        // following a particular regime many different times, each time they do so will be
        // a unique segment
        const createSegmentTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS segments(id INTEGER PRIMARY KEY, regime_id INTEGER NOT NULL, session_start_time INTEGER NOT NULL, end_date_time INTEGER NOT NULL, avg_coherence FLOAT, FOREIGN KEY(regime_id) REFERENCES regimes(id))');
        createSegmentTableStmt.run();
        insertSegmentStmt = db.prepare('INSERT INTO segments(regime_id, session_start_time, end_date_time, avg_coherence) VALUES(?, ?, ?, ?)');

        // a rest segment is one in which a subject breathes at whatever pace they like
        // while sitting quietly
        const createRestSegmentsTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS rest_segments(id INTEGER PRIMARY KEY, end_date_time INTEGER NOT NULL, avg_coherence FLOAT)');
        createRestSegmentsTableStmt.run();
        insertRestSegmentStmt = db.prepare('INSERT INTO rest_segments(end_date_time, avg_coherence) VALUES(?, ?)');

        findRegimeStmt = db.prepare('SELECT id from regimes where duration_ms = ? AND breaths_per_minute = ? AND hold_pos is ? AND randomize = ?');
        insertRegimeStmt = db.prepare('INSERT INTO regimes(duration_ms, breaths_per_minute, hold_pos, randomize) VALUES(?, ?, ?, ?)');
        regimeByIdStmt = db.prepare('SELECT * from regimes where id = ?');

        emwave.subscribe(createSegment);

        return db;
    } catch (err) {
        console.log('Error initializing breath database', err);
        throw(err);
    }
}

ipcMain.handle('login-succeeded', async (_event, session) => {
    if (!db) await initBreathDb(session);
});


function closeBreathDb() {
    if (db) db.close();
}

export {
    closeBreathDb,
    breathDbDir,
    breathDbPath,
    getRegimeId,
    getAllRegimeIds,
    getRegimeStats,
    getRegimesForDay,
    getAvgRestCoherence,
    getRestBreathingDays,
    lookupRegime,
    setRegimeBestCnt,
    getSegmentsAfterDate,
    getTrainingDayCount,
    saveRegimesForDay
}
export const forTesting = { initBreathDb, downloadDatabase, createSegment }
