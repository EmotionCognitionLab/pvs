import { std } from 'mathjs';
import * as bd from "../src/breath-data";

jest.mock('fs/promises', () => ({
    mkdir: jest.fn(() => {})
}));

import { mkdir } from 'fs/promises';

let db;
const tableNames = ['segments', 'rest_segments', 'regimes']; // order is important to avoid foreign key constraint errors on delete

function cleanDb() {
    tableNames.forEach(t => db.exec(`DELETE from ${t}`));
}

function rowCount(tableName) {
    const stmt = db.prepare(`select count(*) from ${tableName}`);
    return stmt.get()["count(*)"];
}

describe("Breathing data functions", () => {
    
    beforeAll(async () => {
        jest.spyOn(bd, "breathDbPath").mockImplementation(() => ":memory:");
        jest.spyOn(bd, "breathDbDir").mockImplementation(() => "/dev/null");
        const downloadSpy = jest.spyOn(bd.forTesting, "downloadDatabase");
        downloadSpy.mockImplementation(() => {});
        db = await bd.forTesting.initBreathDb({
            tokenScopes: {

            },
            idToken: {
                jwtToken: ""
            },
            accessToken: {
                jwtToken: ""
            },
            refreshToken: {
                jwtToken: ""
            },
        });
        expect(downloadSpy).toHaveBeenCalled();
    });

    afterAll(() => {
        bd.closeBreathDb();
    });

    beforeEach(() => {
        cleanDb();
        tableNames.forEach(t => {
            expect(rowCount(t)).toBe(0);
        });
    });

    it("should use an in-memory database in test", () => {
        const path = bd.breathDbPath();
        expect(path).toBe(":memory:");
    });

    it("should insert a row for a regime that doesn't exist when getRegimeId is called", () => {
        const id = bd.getRegimeId({durationMs: 300000, breathsPerMinute: 12, randomize: false});
        const stmt = db.prepare('select id from regimes');
        const res = stmt.all();
        expect(res.length).toBe(1);
        expect(res[0]["id"]).toBe(id);
    });

    it("should set the end_date_time to the current time when createSegment is called", () => {
        const date = new Date(2020, 1, 22, 3, 4, 5);
        const dateSpy = jest.spyOn(global, "Date").mockImplementation(() => date);
        const regime = {
            regime: { durationMs: 300000, breathsPerMinute: 12, randomize: false },
            sessionStartTime: 0,
            avgCoherence: 2.3
        };
        const segId = bd.forTesting.createSegment(regime);
        expect(dateSpy).toHaveBeenCalled();
        dateSpy.mockRestore();
        const segStmt = db.prepare("select * from segments where id = ?");
        const seg = segStmt.get(segId);
        const expectedEndDateTime = date.getTime() / 1000;
        expect(seg["end_date_time"]).toBe(expectedEndDateTime);
    });

    it("should insert the regime associated with a segment when createSegment is called", () => {
        const regime = {
            regime: { durationMs: 300000, breathsPerMinute: 12, randomize: false },
            sessionStartTime: 0,
            avgCoherence: 2.3
        };
        bd.forTesting.createSegment(regime);
        const stmt = db.prepare('select * from regimes');
        const res = stmt.all();
        expect(res.length).toBe(1);
        const savedReg = res[0];
        expect(savedReg["duration_ms"]).toBe(regime.regime.durationMs);
        expect(savedReg["breaths_per_minute"]).toBe(regime.regime.breathsPerMinute);
        expect(savedReg["randomize"]).toBe(regime.regime.randomize ? 1 : 0);
        expect(savedReg["hold_pos"]).toBe(null);
    });

    it("should not insert the regime associated with a segment when createSegment is called if the regime already exists", () => {
        const regime = {
            regime: { durationMs: 300000, breathsPerMinute: 12, randomize: false },
            sessionStartTime: 0,
            avgCoherence: 2.3
        };
        bd.getRegimeId(regime.regime);
        bd.forTesting.createSegment(regime);
        const stmt = db.prepare('select * from regimes');
        const res = stmt.all();
        expect(res.length).toBe(1);
    });

    it("should return the average of all of the rest segment avg_coherence values when getAvgRestCoherence is called", () => {
        const cohValues = [3.2, 2.9, 7, 3.3, 4.7, 5, 2.2];
        const stmt = db.prepare("INSERT INTO rest_segments(end_date_time, avg_coherence) VALUES(?, ?)");
        cohValues.forEach(coh => {stmt.run(0, coh)});
        const expectedMean = cohValues.reduce((prev, cur) => prev + cur, 0) / cohValues.length;
        const avgRestCoherence = bd.getAvgRestCoherence();
        expect(avgRestCoherence).toBeCloseTo(expectedMean);
    });

    it("should return the right statistics when getRegimeStats is called", () => {
        const regime = {
            durationMs: 300000,
            breathsPerMinute: 12,
            holdPos: "postExhale",
            randomize: false
        };
        const cohValues = [1.1, 2., 7.5, 3.9, 3.34, 5, 4.2];
        cohValues.forEach(coh => bd.forTesting.createSegment({regime: regime, avgCoherence: coh, sessionStartTime: 0}));
        const regimeId = bd.getRegimeId(regime);
        const stats = bd.getRegimeStats(regimeId);
        const expectedAvg = cohValues.reduce((prev, cur) => prev+cur, 0) / cohValues.length;
        expect(stats.mean).toBeCloseTo(expectedAvg);
        const stdDev = std(cohValues);
        const interval = 1.96*stdDev;
        expect(stats.low95CI).toBeCloseTo(expectedAvg - interval);
        expect(stats.high95CI).toBeCloseTo(expectedAvg + interval);
    });

    it("getTrainingDayCount should return 0 when the user has done no training", () => {
        expect(bd.getTrainingDayCount()).toBe(0);
    });

    it("getTrainingDayCount should return 0 when the only training the user has done is today", () => {
        const segment = {
            regime: { durationMs: 300000, breathsPerMinute: 12, randomize: false },
            sessionStartTime: 0,
            avgCoherence: 2.3
        };
        bd.forTesting.createSegment(segment);
        expect(rowCount('segments')).toBe(1);
        expect(bd.getTrainingDayCount()).toBe(0);
    });

    it("getTrainingDayCount should coalesce multiple sessions in one day so that that day is counted only once", () => {
        const regime = { durationMs: 300000, breathsPerMinute: 12, randomize: false };
        const coherences = [1.2, 2.7, 2.2, 1.9];
        coherences.forEach(avgCoh => {
            const seg = {regime: regime, avgCoherence: avgCoh, sessionStartTime: Math.floor(Math.random() * 1000)};
            bd.forTesting.createSegment(seg);
        });
        
        const stmt = db.prepare('SELECT id from segments');
        const segIds = stmt.all().map(s => s['id']);
        expect(segIds.length).toBe(coherences.length);

        const updateStmt = db.prepare('UPDATE segments set end_date_time = ? where id = ?');
        const d1 = new Date(2022, 3, 2, 19, 27, 2);
        const d2 = new Date(d1); d2.setSeconds(54);
        const d3 = new Date(2022, 4, 17, 8, 13, 43);
        const d4 = new Date(d3); d3.setMinutes(34);
        const dates = [d1, d2, d3, d4];
        dates.forEach((d, idx) => updateStmt.run(d.getTime() / 1000, segIds[idx]));
        const datesAsDays = dates.map(theDate => `${theDate.getFullYear()}${(theDate.getMonth() + 1).toString().padStart(2,0)}${theDate.getDate().toString().padStart(2, 0)}`);
        const expectedDays = new Set(datesAsDays).size;

        expect(bd.getTrainingDayCount()).toBe(expectedDays);
    });
});