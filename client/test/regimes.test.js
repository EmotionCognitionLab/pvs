import { generateRegimesForDay, getRegimesForSession, forTesting } from "../src/regimes.js";

function regimesEqual(r1, r2) {
    if (Object.entries(r1).length !== Object.entries(r2).length) return false;
    const mandatoryProps = ["durationMs", "breathsPerMinute", "randomize"];
    for (let prop of mandatoryProps) {
        if (!r1.hasOwnProperty(prop)) return false;
        if (!r2.hasOwnProperty(prop)) return false;
        if (r1[prop] !== r2[prop]) return false;
    }
    if (r1.hasOwnProperty("holdPos") && !r2.hasOwnProperty("holdPos")) return false;
    if (!r1.hasOwnProperty("holdPos") && r2.hasOwnProperty("holdPos")) return false;
    if (r1.hasOwnProperty("holdPos") && r1["holdPos"] !== r2["holdPos"]) return false;

    return true;
}

// TODO re-write all tests for generateRegimesForDay as calls to getRegimesForSession
describe("Generating regimes for a given day and experimental condition", () => {
    it("should throw an error if day is < 1", () => {
        expect(() => {
            generateRegimesForDay(forTesting.condA, 0);
        }).toThrow();
    });

    it("should throw an error if the condition is neither a nor b", () => {
        expect(() => {
            generateRegimesForDay('foo', 1);
        }).toThrow();
    });
});

describe.each([
    {day: 1, condition: forTesting.condA, expectedRegimes: forTesting.day1ARegimes},
    {day: 1, condition: forTesting.condB, expectedRegimes: forTesting.day1BRegimes},
    {day: 2, condition: forTesting.condA, expectedRegimes: forTesting.day2ARegimes},
    {day: 2, condition: forTesting.condB, expectedRegimes: forTesting.day2BRegimes},
    {day: 3, condition: forTesting.condA, expectedRegimes: forTesting.day3And4ARegimes},
    {day: 3, condition: forTesting.condB, expectedRegimes: forTesting.day3And4BRegimes},
    {day: 4, condition: forTesting.condA, expectedRegimes: forTesting.day3And4ARegimes},
    {day: 4, condition: forTesting.condB, expectedRegimes: forTesting.day3And4BRegimes}
])("Regimes for day $day, condition $condition", ({day, condition, expectedRegimes}) => {
    it("should match the expected static regimes for the day and condition", () => {
        const res = generateRegimesForDay(condition, day);
        expect(res.length).toBe(6);
        for (let expectedRegime of expectedRegimes) {
            const expectedFoundTimes = res.filter(receivedRegime => regimesEqual(receivedRegime, expectedRegime)).length;
            if (day < 3) {
                expect(expectedFoundTimes).toBe(2);
            } else {
                expect(expectedFoundTimes).toBe(1);
            }
        }
    });
});

jest.mock('../src/breath-data.js', () => ({
    getAvgRestCoherence: jest.fn(() => 0.0),
    getRegimeStats: jest.fn(() => {}),
    getAllRegimeIds: jest.fn(() => [1,2,3]),
    lookupRegime: jest.fn(id => ( {id: id} )),
    setRegimeBestCnt: jest.fn(() => {}),
    getRegimeId: jest.fn(() =>  Math.floor(Math.random() * 100) + 5),
    getRegimesForDay: jest.fn(() => []),
    getSegmentsAfterDate: jest.fn(() => []),
    getTrainingDayCount: jest.fn(() => -1),
    saveRegimesForDay: jest.fn(() => {})
}));

import { getAvgRestCoherence, getRegimeStats, lookupRegime, setRegimeBestCnt, getRegimeId, getAllRegimeIds, saveRegimesForDay } from '../src/breath-data';

describe("Generating regimes for days 5+", () => {
    it("should throw an error when the condition is a and no regimes have confidence intervals overlapping the highest mean coherence", () => {
        const regimeStats = [
            {id: 1, mean: 2.2, low95CI: 2.6, high95CI: 3.0},
            {id: 2, mean: 1.7, low95CI: 2.6, high95CI: 3.0},
            {id: 3, mean: 0.9, low95CI: 2.6, high95CI: 3.0}
        ];
        getRegimeStats.mockImplementation(id => regimeStats.find(rs => rs.id === id));
        expect(() => {
            generateRegimesForDay(forTesting.condA, 17);
        }).toThrow();
    });

    it("should return the regime closest to the average rest coherence when the condition is b and no regimes have confidence intervals overlapping the average rest coherence", () => {
        const avgRestCoherence = 2.3;
        getAvgRestCoherence.mockReturnValueOnce(avgRestCoherence);
        const regimeStats = [
            {id: 1, mean: 2.2, low95CI: 2.6, high95CI: 3.0},
            {id: 2, mean: 1.7, low95CI: 2.6, high95CI: 3.0},
            {id: 3, mean: 0.9, low95CI: 2.6, high95CI: 3.0}
        ];
        getRegimeStats.mockImplementation(id => regimeStats.find(rs => rs.id === id));
        const closestToRestRegime = regimeStats.reduce((prev, cur) => {
            return Math.abs(cur.avg_coherence - avgRestCoherence) < Math.abs(prev.avg_coherence - avgRestCoherence) ? cur : prev;
            },
            {avg_coherence: Number.MAX_SAFE_INTEGER}
        );
        const res = generateRegimesForDay(forTesting.condB, 6);
        expect(res.length).toBe(6);
        expect(res.every(r => r.id === closestToRestRegime.id)).toBeTruthy();
    });

    it("should generate two new regimes when the condition is a and only one regime has a confidence interval overlapping the highest average coherence", () => {
        const regimeStats = [
            // if you change this make sure the first entry is always the highest avg coherence
            {id: 1, mean: 2.7, low95CI: 2.6, high95CI: 3.0}, 
            {id: 2, mean: 1.7, low95CI: 1.6, high95CI: 1.9},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.2}
        ];
        getRegimeStats.mockImplementation(id => regimeStats.find(rs => rs.id === id));
        const fakeBpm = (someVal) => someVal * 4;
        const defaultIsBestCnt = 0;
        lookupRegime.mockImplementationOnce(id => ({id: id, breathsPerMinute: fakeBpm(id), is_best_cnt: defaultIsBestCnt}));
        const res = generateRegimesForDay(forTesting.condA, 5);

        expect(res.length).toBe(6);
        expect(setRegimeBestCnt).toHaveBeenCalledWith(regimeStats[0].id, 1);

        const expectedBpmDiff = 1 / (2 ** (defaultIsBestCnt + 1));
        expect(res.filter(r => r.breathsPerMinute == fakeBpm(regimeStats[0].id) - expectedBpmDiff).length).toBe(2);
        expect(res.filter(r => r.breathsPerMinute == fakeBpm(regimeStats[0].id)).length).toBe(2);
        expect(res.filter(r => r.breathsPerMinute == fakeBpm(regimeStats[0].id) + expectedBpmDiff).length).toBe(2);

        expect(getRegimeId).toHaveBeenCalledTimes(2);
        const call1 = getRegimeId.mock.calls[0][0];
        expect(call1.breathsPerMinute).toBe(fakeBpm(regimeStats[0].id) + expectedBpmDiff);
        expect(call1.is_best_cnt).toBe(0);
        const call2 = getRegimeId.mock.calls[1][0];
        expect(call2.breathsPerMinute).toBe(fakeBpm(regimeStats[0].id) - expectedBpmDiff);
        expect(call2.is_best_cnt).toBe(0);
    });

    it("should use is_best_cnt when generating new regimes in condition a with only one overlapping confidence interval", () => {
        const regimeStats = [
            // if you change this make sure the first entry is always the highest avg coherence
            {id: 1, mean: 2.7, low95CI: 2.6, high95CI: 3.0}, 
            {id: 2, mean: 1.7, low95CI: 1.6, high95CI: 1.9},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.2}
        ];
        getRegimeStats.mockImplementation(id => regimeStats.find(rs => rs.id === id));
        const defaultBpm = 6;
        const defaultIsBestCnt = 2;
        lookupRegime.mockImplementationOnce(id => ({id: id, breathsPerMinute: defaultBpm, is_best_cnt: defaultIsBestCnt}));
        const res = generateRegimesForDay(forTesting.condA, 5);

        expect(res.length).toBe(6);
        const expectedBpmDiff = 1 / (2 ** (defaultIsBestCnt + 1));
        expect(res.filter(r => r.breathsPerMinute == defaultBpm - expectedBpmDiff).length).toBe(2);
        expect(res.filter(r => r.breathsPerMinute == defaultBpm).length).toBe(2);
        expect(res.filter(r => r.breathsPerMinute == defaultBpm + expectedBpmDiff).length).toBe(2);
    });

    it("should use the only regime whose avg coherence overlaps with the avg rest coherence when the condition is b and only one regime overlaps", () => {
        const avgRestCoherence = 2.3;
        getAvgRestCoherence.mockReturnValueOnce(avgRestCoherence);
        const regimeStats = [
            {id: 1, mean: 2.2, low95CI: 2.1, high95CI: 3.0},
            {id: 2, mean: 1.7, low95CI: 1.6, high95CI: 2.0},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.0}
        ];
        getRegimeStats.mockImplementation(id => regimeStats.find(rs => rs.id === id));
        const overlappingRegimes = regimeStats.filter(rs => rs.low95CI <= avgRestCoherence && rs.high95CI >= avgRestCoherence);
        expect(overlappingRegimes.length).toBe(1);
        const expectedRegimeId = overlappingRegimes[0].id;
        const res = generateRegimesForDay(forTesting.condB, 12);
        expect(res.length).toBe(6);
        expect(res.every(r => r.id === expectedRegimeId)).toBeTruthy();
    });

    describe.each([
        {condition: forTesting.condA, avgRestCoherence: null, overlapCnt: 2, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 2.1, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.8, high95CI: 2.4},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.0}
        ]},
        {condition: forTesting.condB, avgRestCoherence: 1.8, overlapCnt: 2, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 2.1, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.7, high95CI: 2.0},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.9}
        ]},
        {condition: forTesting.condA, avgRestCoherence: null, overlapCnt: 3, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 2.1, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.8, high95CI: 2.4},
            {id: 3, mean: 1.9, low95CI: 1.6, high95CI: 2.3}
        ]},
        {condition: forTesting.condB, avgRestCoherence: 1.8, overlapCnt: 3, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 1.7, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.7, high95CI: 2.0},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.9}
        ]},
        {condition: forTesting.condA, avgRestCoherence: null, overlapCnt: 4, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 2.1, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.8, high95CI: 2.4},
            {id: 3, mean: 1.9, low95CI: 1.6, high95CI: 2.3},
            {id: 4, mean: 1.8, low95CI: 1.6, high95CI: 2.2}
        ]},
        {condition: forTesting.condB, avgRestCoherence: 1.8, overlapCnt: 4, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 1.7, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.7, high95CI: 2.0},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.9},
            {id: 4, mean: 1.9, low95CI: 1.8, high95CI: 2.0}
        ]},
        {condition: forTesting.condA, avgRestCoherence: null, overlapCnt: 5, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 2.1, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.8, high95CI: 2.4},
            {id: 3, mean: 1.9, low95CI: 1.6, high95CI: 2.3},
            {id: 4, mean: 1.8, low95CI: 1.6, high95CI: 2.2},
            {id: 5, mean: 2.0, low95CI: 2.0, high95CI: 2.21}
        ]},
        {condition: forTesting.condB, avgRestCoherence: 1.8, overlapCnt: 5, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 1.7, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.7, high95CI: 2.0},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.9},
            {id: 4, mean: 1.9, low95CI: 1.8, high95CI: 2.0},
            {id: 5, mean: 1.8, low95CI: 1.7, high95CI: 2.0}
        ]},
        {condition: forTesting.condA, avgRestCoherence: null, overlapCnt: 6, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 2.1, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.8, high95CI: 2.4},
            {id: 3, mean: 1.9, low95CI: 1.6, high95CI: 2.3},
            {id: 4, mean: 1.8, low95CI: 1.6, high95CI: 2.2},
            {id: 5, mean: 2.0, low95CI: 2.0, high95CI: 2.21},
            {id: 6, mean: 2.15, low95CI: 1.77, high95CI: 2.3}
        ]},
        {condition: forTesting.condB, avgRestCoherence: 1.8, overlapCnt: 6, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 1.7, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.7, high95CI: 2.0},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.9},
            {id: 4, mean: 1.9, low95CI: 1.8, high95CI: 2.0},
            {id: 5, mean: 1.8, low95CI: 1.7, high95CI: 2.0},
            {id: 6, mean: 1.93, low95CI: 1.62, high95CI: 1.94}
        ]},
        {condition: forTesting.condA, avgRestCoherence: null, overlapCnt: 7, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 2.1, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.8, high95CI: 2.4},
            {id: 3, mean: 1.9, low95CI: 1.6, high95CI: 2.3},
            {id: 4, mean: 1.8, low95CI: 1.6, high95CI: 2.2},
            {id: 5, mean: 2.0, low95CI: 2.0, high95CI: 2.21},
            {id: 6, mean: 2.15, low95CI: 1.77, high95CI: 2.3},
            {id: 7, mean: 1.76, low95CI: 1.5, high95CI: 2.2}
        ]},
        {condition: forTesting.condB, avgRestCoherence: 1.8, overlapCnt: 7, regimeStats: [
            {id: 1, mean: 2.2, low95CI: 1.7, high95CI: 3.0},
            {id: 2, mean: 2.0, low95CI: 1.7, high95CI: 2.0},
            {id: 3, mean: 0.9, low95CI: 0.6, high95CI: 1.9},
            {id: 4, mean: 1.9, low95CI: 1.8, high95CI: 2.0},
            {id: 5, mean: 1.8, low95CI: 1.7, high95CI: 2.0},
            {id: 6, mean: 1.93, low95CI: 1.62, high95CI: 1.94},
            {id: 7, mean: 1.8, low95CI: 1.19, high95CI: 17.4}
        ]},
    ])("for condition $condition with $overlapCnt overlapping regimes", ({condition, avgRestCoherence, overlapCnt, regimeStats}) => {
        it("should use the overlapping regimes (and only the overlapping regimes)", () => {
            const allRegimeIds = regimeStats.map(rs => rs.id);
            getAllRegimeIds.mockImplementation(() => allRegimeIds);
            getAvgRestCoherence.mockReturnValue(avgRestCoherence);
            getRegimeStats.mockImplementation(id => regimeStats.find(rs => rs.id === id));
            let targetCoh = condition === forTesting.condA ? Math.max(...(regimeStats.map(rs => rs.mean))) : avgRestCoherence;
            const expectedRegimes = regimeStats.filter(rs => rs.low95CI <= targetCoh && rs.high95CI >= targetCoh);
            const res = generateRegimesForDay(condition, 14);
            expect(res.length).toBe(6);
            const expectedRegimeIds = expectedRegimes.map(er => er.id);
            expect(res.every(receivedRegime => expectedRegimeIds.includes(receivedRegime.id))).toBeTruthy();
            const receivedRegimeIds = res.map(r => r.id);
            if (overlapCnt <= 6) { // if we have more than 6 regimes to pick from we aren't going to use all of them
                expect(expectedRegimeIds.every(id => receivedRegimeIds.includes(id))).toBeTruthy();
            }
            if (6 % overlapCnt === 0) {
                // check that every regime is evenly represented
                const idCount = {};
                res.forEach(r => idCount[r.id] = idCount[r.id] ? idCount[r.id] + 1 : 1);
                expect(Object.values(idCount).every(v => v === 6 / Object.keys(idCount).length)).toBeTruthy();
            }
        });
    });
});

import { getRegimesForDay, getSegmentsAfterDate, getTrainingDayCount } from '../src/breath-data';

/**
 * Given a list of regimes, return those that can be completed within durationMs.
 * @param {*} regimes 
 * @param {*} durationMs 
 */
function getRegimesForDuration(regimes, durationMs) {
    const regimeTimeRunningSum = regimes.reduce((prev, cur) => {
        prev.push(cur.durationMs + prev[prev.length - 1]);
        return prev;
     }, [0]).slice(1);
    return regimes.map((r, idx) => regimeTimeRunningSum[idx] <= durationMs ? r : -1).filter(i => i != -1);
}

describe("getRegimesForSession", () => {

    const makeRegime = (id) => ({id: id, durationMs: 300000});

    beforeAll(() => {
        // so that tests don't inadvertently break if run too close to midnight,
        // causing filterRegimesByAvailableSessionTime to filter out some regimes
        // that should be in
        const date = new Date();
        date.setHours(0); date.setMinutes(0); date.setSeconds(0);
        jest.useFakeTimers("modern");
        jest.setSystemTime(date);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    it("should throw if the number of regimes for the day is > 0 and !== 6", () => {
        const regimeSets = [[3,5], [1,2,3,4,5,6,7]]
        regimeSets.forEach(rs => {
            const regimes = rs.map(makeRegime);
            getRegimesForDay.mockImplementation(() => regimes);
            expect(() => {
                getRegimesForSession('a');
            }).toThrow();   
        }); 
    });

    it("should filter out regimes already done today", () => {
        const regimeIds = [1,2,3,4,5,6];
        const regimes = regimeIds.map(makeRegime);
        getRegimesForDay.mockImplementation(() => regimes);
        
        
        const doneSegments = regimeIds.slice(0,3).map(id => ({regimeId: id}));
        getSegmentsAfterDate.mockImplementation(() => doneSegments);

        const expectedRegimes = [];
        regimes.forEach((r, idx) => {
            if (idx > doneSegments.length - 1 || r.id !== doneSegments[idx].regimeId) {
                expectedRegimes.push(r);
            }
        });

        const forSession = getRegimesForSession('b');
        const today = new Date();
        today.setHours(0); today.setMinutes(0); today.setSeconds(0);
        expect(getSegmentsAfterDate).toHaveBeenCalledWith(today);
        expect(forSession).toEqual(expectedRegimes);
    });

    it("should filter out a regime already done today only the number of times it has been done", () => {
        const regimeIds = [1,1,1,1,2,3];
        const regimes = regimeIds.map(makeRegime);
        getRegimesForDay.mockImplementation(() => regimes);

        const doneSegments = regimeIds.slice(0, 3).map(id => ({regimeId: id}));
        getSegmentsAfterDate.mockImplementation(() => doneSegments);

        const expectedRegimes = [];
        regimes.forEach((r, idx) => {
            if (idx > doneSegments.length - 1 || r.id !== doneSegments[idx].regimeId) {
                expectedRegimes.push(r);
            }
        });
        const forSession = getRegimesForSession('a');
        expect(forSession).toEqual(expectedRegimes);
    });

    it("should never return more than 15 minutes worth of regimes", () => {
        const regimeIds = [3,4,5,6];
        const regimes = [{id: 1, durationMs: 800000}, {id: 2, durationMs: 100000}];
        regimes.push(...regimeIds.map(makeRegime));
        getRegimesForDay.mockImplementation(() => regimes);
        getSegmentsAfterDate.mockImplementation(() => []);
        
        const expectedRegimes = getRegimesForDuration(regimes,  15 * 60 * 1000);
        
        const forSession = getRegimesForSession('b');
        expect(forSession).toEqual(expectedRegimes);
    });

    it("should never return a session that can't be completed by midnight", () => {
        const regimeIds = [1,2,3,4,5,6];
        const regimes = regimeIds.map(makeRegime);
        getRegimesForDay.mockImplementation(() => regimes);

        const date = new Date();
        date.setHours(23); date.setMinutes(54); date.setSeconds(0);
        jest.setSystemTime(date);

        const midnight = new Date();
        midnight.setHours(23); midnight.setMinutes(59); midnight.setSeconds(59);
        const msRemainingToday = midnight.getTime() - date.getTime();
        const expectedRegimes = getRegimesForDuration(regimes, msRemainingToday);
       
        getSegmentsAfterDate.mockImplementation(() => []);
        const forSession = getRegimesForSession('b');
        expect(forSession).toEqual(expectedRegimes);
    });

    it("should not return a session that can't be completed by midnight even for the first session of the day", () => {
        getRegimesForDay.mockImplementation(() => []);
        getSegmentsAfterDate.mockImplementation(() => []);
        getTrainingDayCount.mockImplementation(() => 0);

        const date = new Date();
        date.setHours(23); date.setMinutes(54); date.setSeconds(0);
        jest.setSystemTime(date);

        const midnight = new Date();
        midnight.setHours(23); midnight.setMinutes(59); midnight.setSeconds(59);
        const msRemainingToday = midnight.getTime() - date.getTime();
        
        const forSession = getRegimesForSession('a');
        const sessionDuration = forSession.reduce((prev, cur) => prev.durationMs + cur.durationMs, {durationMs: 0});
        expect(sessionDuration).toBeLessThanOrEqual(msRemainingToday);
    });

    it("should call saveRegimesForDay", () => {
        getRegimesForDay.mockImplementation(() => []);
        getSegmentsAfterDate.mockImplementation(() => []);
        getTrainingDayCount.mockImplementation(() => 0);
        const forSession = getRegimesForSession('a');
        expect(saveRegimesForDay).toHaveBeenCalled();
    });
});