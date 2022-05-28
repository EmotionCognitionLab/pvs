import { app, ipcMain } from 'electron';
import { statSync } from 'fs';
import { mean, std } from 'mathjs';
import emwave from './emwave.js';
import Database from 'better-sqlite3';
import s3utils from './s3utils.js'
import { SessionStore } from './session-store.js'

let db;
let insertSegmentStmt, findRegimeStmt, insertRegimeStmt, regimeByIdStmt;

function breathDbPath() {
    let breathDbPath;
    const userHome = app.getPath('home');
    if (process.platform === 'darwin') {
        breathDbPath = userHome +  '/Documents/HeartBeam/heartBeam.sqlite';
    } else if (process.platform === 'win32') {
        breathDbPath = userHome + '\\Documents\\HeartBeam\\heartBeam.sqlite';
    } else {
        throw `The '${process.platform}' operating system is not supported. Please use either Macintosh OS X or Windows.`;
    }

    return breathDbPath;
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

    if (res.randomize === 0) {
        res.randomize = false;
    } else {
        res.randomize = true;
    }
    return res;
}

function createSegment(regimeData) {
    const regimeId = getRegimeId(regimeData.regime);
    const newSegment = insertSegmentStmt.run(
        regimeId,
        regimeData.sessionStartTime,
        Math.round((new Date).getTime() / 1000),
        regimeData.avgCoherence
    );
    if (newSegment.changes !== 1) {
        throw new Error(`Error adding segment with start time ${sessionStartTime}`);
    }
    return newSegment.lastInsertRowid;
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

function setRegimeBestCnt(regimeId, count) {
    const updateStmt = db.prepare('UPDATE regimes set is_best_cnt = ? where id = ?');
    const res = updateStmt.run(count, regimeId);
    if (res.changes != 1) {
        throw new Error(`Error updating is_best_cnt for regime ${regimeId}. Expected it to update one row, but it updated ${newRegime.changes}.`);
    }
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

export { closeBreathDb, breathDbPath, getRegimeId, getAllRegimeIds, getRegimeStats, getAvgRestCoherence, lookupRegime, setRegimeBestCnt }
export const forTesting = { initBreathDb, downloadDatabase, createSegment }
