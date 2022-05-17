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

function createSegment(startTime) {
    const newSegment = insertSegmentStmt.run(startTime);
    if (newSegment.changes !== 1) {
        throw new Error(`Error adding segment with start time ${startTime}`);
    }
    return newSegment.lastInsertRowid;
}

function insertIbiData(data) {
    if (data.ibiType !== 'interpolated') return;

    insertIbiStmt.run(
        curRegimeId,
        Math.round((new Date).getTime() / 1000),
        curSegmentId,
        data.stime,
        data.ibi,
        data.ep,
        Math.log((data.ep / 10) + 1),
        data.artifact ? 1 : 0
    ); 
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
const createSegmentTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS segments(id INTEGER PRIMARY KEY, start_time INTEGER NOT NULL)');
createSegmentTableStmt.run();
const insertSegmentStmt = db.prepare('INSERT INTO segments(start_time) VALUES(?)');

const createIbiTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS ibi_data(id INTEGER PRIMARY KEY, regime_id INTEGER NOT NULL, segment_id INTEGER NOT NULL, date_time INTEGER NOT NULL, stime INTEGER NOT NULL, ibi INTEGER NOT NULL, ep INTEGER NOT NULL, coherence FLOAT NOT NULL, artifact BOOLEAN NOT NULL, FOREIGN KEY(regime_id) REFERENCES regimes(id), FOREIGN KEY(segment_id) REFERENCES segments(id))');
createIbiTableStmt.run();

const insertIbiStmt = db.prepare('INSERT INTO ibi_data(regime_id, date_time, segment_id, stime, ibi, ep, coherence, artifact) VALUES(?, ?, ?, ?, ?, ?, ?, ?)');

const findRegimeStmt = db.prepare('SELECT id from regimes where duration_ms = ? AND breaths_per_minute = ? AND hold_pos is ? AND randomize = ?');
const insertRegimeStmt = db.prepare('INSERT INTO regimes(duration_ms, breaths_per_minute, hold_pos, randomize) VALUES(?, ?, ?, ?)');

// TODO if I leave the app open between sessions, is there a chance that one of these could
// accidentally not get reset before the first ibi data from the second session needs to be written?
// (i.e. a race condition between the start regime notification and the ibi data notification)
let curRegimeId;
let curSegmentId;
ipcMain.handle('pacer-regime-changed', (_event, startTime, regime) => {
    curRegimeId = getRegimeId(regime);
    curSegmentId = createSegment(startTime);
});
emwave.subscribe(insertIbiData);

function closeBreathDb() {
    curRegimeId = null;
    curSegmentId = null;
    db.close();
}

export { closeBreathDb, breathDbPath }
