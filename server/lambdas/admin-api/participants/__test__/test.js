import { baselineStatus, stage2Status, stage3Status, lumosityStatus } from "../status.js"
import dayjs from 'dayjs';

const mockDb = (results, lumosPlays = []) => ({
    getSetsForUser: (userId) => {
        return results;
    },

    segmentsForUser: (humanId) => {
        return results;
    },

    lumosPlaysForUser: (userId) => {
        return lumosPlays;
    }
});

describe("pre-baseline complete status", () => {
    it("should return red if the user has done no sets", async () => {
        const status = await baselineStatus(mockDb([]), '123abc');
        expect(status.status).toBe('red');
    });

    it.each([1, 22, 27, 47])
        ("should return green if the user started < 2 days ago (%p hours)", async hours => {
            const now = dayjs();
            const firstSetDate = now.subtract(hours, 'hours');
            const status = await baselineStatus(mockDb([{dateTime: firstSetDate.toISOString()}]), 'abc321');
            expect(status.status).toBe('green');
    });

    it("should return green if the user started <= 4 days ago and has done >=3 sets", async () => {
        await checkBaselineStatus(90, 3, 'green');
    });

    it("should return yellow if the user started < 4 days ago and has done < 3 sets", async () => {
        await checkBaselineStatus(90, 0, 'yellow');
    });

    it("should return green if the user started >= 4 days ago and has done >=4 sets", async () => {
        await checkBaselineStatus(100, 4, 'green');
    });

    it("should return red if the user started >= 4 days ago and has done 2 sets", async () => {
        await checkBaselineStatus(240, 2, 'red');
    });

    it("should return yellow if the user started >= 4 days ago and has done 3 sets", async () => {
        await checkBaselineStatus(240, 3, 'red');
    });

    it("should return red if the user started >= 4 days ago and has done < 2 sets", async () => {
        await checkBaselineStatus(100, 1, 'red');
    });

    it("should return red if the user started >= 9 days ago and has done < 7 sets", async () => {
        await checkBaselineStatus(220, 6, 'red');
    })

});

describe("lumosity status", () => {
    it.each([4,5])("should return green if the user has played 6 games/day for %p of the last six days", async (days) => {
        checkLumosityStatus(days, 'green');
    });

    it.each([2,3])("should return yellow if the user has played 6 games/day for %p of the last six days", async (days) => {
        checkLumosityStatus(days, 'yellow');
    });

    it.each([0,1])("should return red if the user has played 6 games/day for %p of the last six days", async (days) => {
        checkLumosityStatus(days, 'red');
    });
});

const stage2BreathingConditions = [
    { startDaysAgo: 0, numSegs: 1, exp: 'green'},
    { startDaysAgo: 2, numSegs: 2, exp: 'green'},
    { startDaysAgo: 2, numSegs: 1, exp: 'green'},
    { startDaysAgo: 3, numSegs: 2, exp: 'green'},
    { startDaysAgo: 3, numSegs: 1, exp: 'yellow'},
    { startDaysAgo: 4, numSegs: 4, exp: 'green'},
    { startDaysAgo: 4, numSegs: 3, exp: 'green'},
    { startDaysAgo: 4, numSegs: 2, exp: 'yellow'},
    { startDaysAgo: 4, numSegs: 1, exp: 'red'},
    { startDaysAgo: 5, numSegs: 2, exp: 'red'},
];

describe("stage 2 status", () => {
    it("should return gray if the user has done no segments (has not done stage 1)", async () => {
        const status = await stage2Status(mockDb([]), '123abc');
        expect(status.status).toBe('gray');
    });

    describe("if the user has played 6 lumosity games/day 0 or 1 days in the last six days", () => {
        const lumosData = buildLumosityData(1);

        describe.each(stage2BreathingConditions)("if the user started $startDaysAgo days ago and has done $numSegs breathing segments",
            ({startDaysAgo, numSegs, exp}) => {
                it("should return red", async () => {
                    const status = await checkStage2Status(startDaysAgo, numSegs, lumosData);
                    expect(status.status).toBe('red');
                    expect(status.lumosity).toBe('red');
                    expect(status.breathing).toBe(exp);
                });
        });

    });

    describe("if the user has played 6 lumosity games/day 2 or 3 days in the last six days", () => {
        const lumosData = buildLumosityData(3);
        const nonRedConds = stage2BreathingConditions.filter(c => c.exp !== 'red');
        const redConds = stage2BreathingConditions.filter(c => c.exp === 'red');

        describe.each(nonRedConds)("if the user started $startDaysAgo days ago and has done $numSegs breathing segments",
            ({startDaysAgo, numSegs, exp}) => {
                it("should return yellow", async () => {
                    const status = await checkStage2Status(startDaysAgo, numSegs, lumosData);
                    expect(status.status).toBe('yellow');
                    expect(status.lumosity).toBe('yellow');
                    expect(status.breathing).toBe(exp);
                });
        });

        describe.each(redConds)("if the user started $startDaysAgo days ago and has done $numSegs breathing segments",
            ({startDaysAgo, numSegs, exp}) => {
                it("should return red", async () => {
                    const status = await checkStage2Status(startDaysAgo, numSegs, lumosData);
                    expect(status.status).toBe('red');
                    expect(status.lumosity).toBe('yellow');
                    expect(status.breathing).toBe(exp);
                });
        });
    });

    describe("if the user has played 6 lumosity games/day 4 or more days in the last six days", () => {
        const lumosData = buildLumosityData(4);

        describe.each(stage2BreathingConditions)("if the user started $startDaysAgo days ago and has done $numSegs breathing segments it should return $exp",
            ({startDaysAgo, numSegs, exp}) => {
                it("", async () => {
                    const status = await checkStage2Status(startDaysAgo, numSegs, lumosData);
                    expect(status.status).toBe(exp);
                    expect(status.lumosity).toBe('green');
                    expect(status.breathing).toBe(exp);
                });
        });
    });
    
});

const stage3BreathingConditions = [
    { startDaysAgo: 0, numSegs: 1, exp: 'green'},
    { startDaysAgo: 2, numSegs: 12, exp: 'green'},
    { startDaysAgo: 2, numSegs: 6, exp: 'green'},
    { startDaysAgo: 3, numSegs: 12, exp: 'green'},
    { startDaysAgo: 3, numSegs: 6, exp: 'yellow'},
    { startDaysAgo: 4, numSegs: 24, exp: 'green'},
    { startDaysAgo: 4, numSegs: 18, exp: 'green'},
    { startDaysAgo: 4, numSegs: 12, exp: 'yellow'},
    { startDaysAgo: 4, numSegs: 6, exp: 'red'},
    { startDaysAgo: 5, numSegs: 12, exp: 'red'},
];

describe("stage 3 status", () => {

    describe("if the user has played 6 lumosity games/day 0 or 1 days in the last six days", () => {
        const lumosData = buildLumosityData(1);

        describe.each(stage3BreathingConditions)("if the user started $startDaysAgo days ago and has done $numSegs breathing segments",
            ({startDaysAgo, numSegs, exp}) => {
                it("should return red", async () => {
                    const status = await checkStage3Status(startDaysAgo, numSegs, lumosData);
                    expect(status.status).toBe('red');
                    expect(status.lumosity).toBe('red');
                    expect(status.breathing).toBe(exp);
                });
        });

    });

    describe("if the user has played 6 lumosity games/day 2 or 3 days in the last six days", () => {
        const lumosData = buildLumosityData(3);
        const nonRedConds = stage3BreathingConditions.filter(c => c.exp !== 'red');
        const redConds = stage3BreathingConditions.filter(c => c.exp === 'red');

        describe.each(nonRedConds)("if the user started $startDaysAgo days ago and has done $numSegs breathing segments",
            ({startDaysAgo, numSegs, exp}) => {
                it("should return yellow", async () => {
                    const status = await checkStage3Status(startDaysAgo, numSegs, lumosData);
                    expect(status.status).toBe('yellow');
                    expect(status.lumosity).toBe('yellow');
                    expect(status.breathing).toBe(exp);
                });
        });

        describe.each(redConds)("if the user started $startDaysAgo days ago and has done $numSegs breathing segments",
            ({startDaysAgo, numSegs, exp}) => {
                it("should return red", async () => {
                    const status = await checkStage3Status(startDaysAgo, numSegs, lumosData);
                    expect(status.status).toBe('red');
                    expect(status.lumosity).toBe('yellow');
                    expect(status.breathing).toBe(exp);
                });
        });
    });

    describe("if the user has played 6 lumosity games/day 4 or more days in the last six days", () => {
        const lumosData = buildLumosityData(4);

        describe.each(stage3BreathingConditions)("if the user started $startDaysAgo days ago and has done $numSegs breathing segments it should return $exp",
            ({startDaysAgo, numSegs, exp}) => {
                it("", async () => {
                    const status = await checkStage3Status(startDaysAgo, numSegs, lumosData);
                    expect(status.status).toBe(exp);
                    expect(status.lumosity).toBe('green');
                    expect(status.breathing).toBe(exp);
                });
        });
    });
    
});

async function checkBaselineStatus(startHoursAgo, numSetsDone, expectedStatus) {
    const now = dayjs();
    const firstSetDate = now.subtract(startHoursAgo, 'hours');
    const results = [
        { dateTime: firstSetDate.toISOString(), experiment: 'set-started' },
    ];
    for (let i = 0; i < numSetsDone; i++) {
        results.push({experiment: 'set-finished'});
    }
    const status = await baselineStatus(mockDb(results), 'abc321');
    expect(status.status).toBe(expectedStatus);
}

async function checkStage2Status(startDaysAgo, numSegmentsDone, lumosData) {
    const now = dayjs();
    const firstSegmentDate = now.subtract(startDaysAgo, 'days');
    const results = [
        { endDateTime: firstSegmentDate.unix() }
    ];
    for (let i = 0; i < numSegmentsDone; i++) {
        results.push({});
    }
    return await stage2Status(mockDb(results, lumosData), '123456');
}

async function checkStage3Status(startDaysAgo, numSegmentsDone, lumosData) {
    const now = dayjs();
    const stage2CompletedDate = now.subtract(startDaysAgo, 'days').format("YYYYMMDD");
    const results = [];
    for (let i = 0; i < numSegmentsDone; i++) {
        results.push({stage: 3});
    }
    return await stage3Status(mockDb(results, lumosData), '123456', 'FastCow', stage2CompletedDate);
}

function buildLumosityData(numDaysWithSixPlays) {
    const daysAgo = [6,5,4,3,2,1];
    const daysWithFullPlay = daysAgo.slice(0, numDaysWithSixPlays);
    const fullPlays = daysWithFullPlay.flatMap(d => {
        const date = dayjs().subtract(d, 'days').format('YYYY-MM-DD');
        return [1,2,3,4,5,6].map(() => ({dateTime: date}));
    });
    const nonFullPlays = daysAgo.slice(numDaysWithSixPlays).flatMap(d => {
        const date = dayjs().subtract(d, 'days').format('YYYY-MM-DD');
        const numPlays = Math.floor(Math.random() * 5);
        const res = [];
        for (let i = 0; i < numPlays; i++) {
            res.push({dateTime: date});
        }
        return res;
    });
    return [...fullPlays, ...nonFullPlays];
}

async function checkLumosityStatus(numDaysWithSixPlays, expectedStatus) {
    const allPlays = buildLumosityData(numDaysWithSixPlays);
    const status = await lumosityStatus(mockDb([], allPlays), 'abc123');
    expect(status).toBe(expectedStatus);
}