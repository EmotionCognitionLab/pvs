import { app, ipcMain } from 'electron';
import { statSync } from 'fs';
import emwave from './emwave.js';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';


function heartDbPath() {
    let heartDbPath;
    const userHome = app.getPath('home');
    if (process.platform === 'darwin') {
        heartDbPath = userHome +  '/Documents/HeartBeam/heartBeam.sql';
    } else if (process.platform === 'win32') {
        heartDbPath = userHome + '\\Documents\\HeartBeam\\heartBeam.sql';
    } else {
        throw `The '${process.platform}' operating system is not supported. Please use either Macintosh OS X or Windows.`;
    }

    return heartDbPath;
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

function insertIbiData(data) {
    if (data.ibiType !== 'interpolated') return;

    insertIbiStmt.run(
        curRegimeId,
        Math.round((new Date).getTime() / 1000),
        curSegmentUuid,
        data.stime,
        data.ibi,
        data.ep,
        Math.log((data.ep / 10) + 1),
        data.artifact ? 1 : 0
    ); 
}

try {
    statSync(heartDbPath());
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
const db = new Database(heartDbPath());
const createRegimeTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS regimes(id INTEGER PRIMARY KEY, duration_ms INTEGER NOT NULL, breaths_per_minute INTEGER NOT NULL, hold_pos TEXT, randomize BOOLEAN NOT NULL)');
createRegimeTableStmt.run();
const createIbiTableStmt = db.prepare('CREATE TABLE IF NOT EXISTS ibi_data(id INTEGER PRIMARY KEY, regime_id INTEGER NOT NULL, segment_guid TEXT, date_time INTEGER NOT NULL, stime INTEGER NOT NULL, ibi INTEGER NOT NULL, ep INTEGER NOT NULL, coherence FLOAT NOT NULL, artifact BOOLEAN NOT NULL, FOREIGN KEY(regime_id) REFERENCES regimes(id))');
createIbiTableStmt.run();

const insertIbiStmt = db.prepare('INSERT INTO ibi_data(regime_id, date_time, segment_guid, stime, ibi, ep, coherence, artifact) VALUES(?, ?, ?, ?, ?, ?, ?, ?)');

const findRegimeStmt = db.prepare('SELECT id from regimes where duration_ms = ? AND breaths_per_minute = ? AND hold_pos is ? AND randomize = ?');
const insertRegimeStmt = db.prepare('INSERT INTO regimes(duration_ms, breaths_per_minute, hold_pos, randomize) VALUES(?, ?, ?, ?)');

// TODO if I leave the app open between sessions, is there a chance that one of these could
// accidentally not get reset before the first ibi data from the second session needs to be written?
// (i.e. a race condition between the start regime notification and the ibi data notification)
let curRegimeId;
let curRegimeStartTime;
let curSegmentUuid;
ipcMain.handle('pacer-regime-changed', (_event, startTime, regime) => {
    curRegimeStartTime = startTime;
    curRegimeId = getRegimeId(regime);
    curSegmentUuid = uuidv4();
});
emwave.subscribe(insertIbiData);

function closeHeartDb() {
    curRegimeId = null;
    curRegimeStartTime = null;
    curSegmentUuid = null;
    db.close();
}

export { closeHeartDb, heartDbPath }
