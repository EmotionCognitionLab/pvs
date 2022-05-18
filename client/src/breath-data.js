import { app, ipcMain } from 'electron';
import { statSync } from 'fs';
import emwave from './emwave.js';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';


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


function downloadDatabase(srcUrl, destPath) {
    // TODO make sure this throws if we encounter a download
    // error. We don't want to silently fail to downlaod
    // an existing db and inadvertently create a new one

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

try {
    statSync(breathDbPath());
} catch (err) {
    if (err.code === 'ENOENT') {
        downloadDatabase();
    } else {
        throw(err);
    }
}

// at this point if we don't have a db
// then either it's a new user or we've
// lost all their data :-(
// either way, we can let sqlite create the database
// if necessary
const db = new Database(breathDbPath());
const createRegimeTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS regimes(id INTEGER PRIMARY KEY, duration_ms INTEGER NOT NULL, breaths_per_minute INTEGER NOT NULL, hold_pos TEXT, randomize BOOLEAN NOT NULL)');
createRegimeTableStmt.run();

// a segment is portion (usually five minutes) of a longer emwave session (usually fifteen minutes) 
// during which breathing happens under a given regime
// a segment is eseentially an instance of a regime - while participants may breathe
// following a particular regime many different times, each time they do so will be
// a unique segment
const createSegmentTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS segments(id INTEGER PRIMARY KEY, regime_id INTEGER NOT NULL, session_start_time INTEGER NOT NULL, end_date_time INTEGER NOT NULL, avg_coherence FLOAT, FOREIGN KEY(regime_id) REFERENCES regimes(id))');
createSegmentTableStmt.run();
const insertSegmentStmt = db.prepare('INSERT INTO segments(regime_id, session_start_time, end_date_time, avg_coherence) VALUES(?, ?, ?, ?)');

const findRegimeStmt = db.prepare('SELECT id from regimes where duration_ms = ? AND breaths_per_minute = ? AND hold_pos is ? AND randomize = ?');
const insertRegimeStmt = db.prepare('INSERT INTO regimes(duration_ms, breaths_per_minute, hold_pos, randomize) VALUES(?, ?, ?, ?)');

emwave.subscribe(createSegment);

function closeBreathDb() {
    db.close();
}

export { closeBreathDb, breathDbPath }
