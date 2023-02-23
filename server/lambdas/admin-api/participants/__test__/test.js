import { baselineStatus, stage2Status, stage3Status, lumosityStatus } from "../status.js"
import dayjs from 'dayjs';

const mockDb = (results, lumosPlays = [], user) => ({
    getSetsForUser: (userId) => {
        return results;
    },

    segmentsForUser: (humanId) => {
        return results;
    },

    lumosPlaysForUser: (userId) => {
        return lumosPlays;
    },

    getUser: (userId)  => {
        return user;
    }
});

describe("pre-baseline complete status", () => {
    it("should return red if the user started >= 2 days ago and has done no sets", async () => {
        await checkBaselineStatus(57, 0, 'red');
    });

    it.each([1, 22, 27, 47])
        ("should return green if the user started < 2 days ago (%p hours)", async hours => {
            const now = dayjs();
            const firstSetDate = now.subtract(hours, 'hours');
            const status = await baselineStatus(mockDb([{dateTime: firstSetDate.toISOString()}], [], { startDate: firstSetDate.format('YYYY-MM-DD')}), 'abc321');
            expect(status.status).toBe('green');
    });

    it("should return green if the user started <= 4 days ago and has done >=3 sets", async () => {
        await checkBaselineStatus(90, 3, 'green');
    });

    it("should return yellow if the user started < 4 days ago and has done >=1 and < 3 sets", async () => {
        await checkBaselineStatus(90, 1, 'yellow');
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
    });

    it("should use the createdAt date if the user has no start date", async () => {
        const now = dayjs();
        const daysAgo = now.subtract(77, 'hours');
        const status = await baselineStatus(mockDb([{experimentDateTime: "set-started|2023-01-01T00:00:00.000Z"}], [], { createdAt: daysAgo.toISOString()}));
        expect(status.status).toBe('yellow');
    });

});

describe("lumosity status", () => {
    describe("for users who started >3 days ago", () => {
        it.each([4,5])("should return green if the user has played 6 games/day for %p of the last six days", async (days) => {
            checkLumosityStatus(days, 'green', 10);
        });
    
        it.each([2,3])("should return yellow if the user has played 6 games/day for %p of the last six days", async (days) => {
            checkLumosityStatus(days, 'yellow', 10);
        });
    
        it.each([0,1])("should return red if the user has played 6 games/day for %p of the last six days", async (days) => {
            checkLumosityStatus(days, 'red', 10);
        });
    });

    describe("for users who started <= 1 day ago", () => {
        it.each([0,1,2,3,4,5])("should return green if the user has played 6 games/day for %p of the last six days", async (days) => {
            checkLumosityStatus(days, 'green', 1);
        });
    });

    describe("for users who started 2 or 3 days ago", () => {
        it.each([0,1])("should return yellow if the user has played 6 games/day for %p of the last six days", async (days) => {
            checkLumosityStatus(days, 'yellow', 2);
        });
        it.each([0,1])("should return yellow if the user has played 6 games/day for %p of the last six days", async (days) => {
            checkLumosityStatus(days, 'yellow', 3);
        });
        it.each([2,3,4,5])("should return green if the user has played 6 games/day for %p of the last six days", async (days) => {
            checkLumosityStatus(days, 'green', 3);
        });
        it.each([2,3,4,5])("should return green if the user has played 6 games/day for %p of the last six days", async (days) => {
            checkLumosityStatus(days, 'green', 2);
        });
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
                if (startDaysAgo <= 1) {
                    it("should return green", async () => {
                        const status = await checkStage2Status(startDaysAgo, numSegs, lumosData);
                        expect(status.status).toBe('green');
                        expect(status.lumosity).toBe('green');
                        expect(status.breathing).toBe('green');
                    });
                } else if (startDaysAgo == 2 || startDaysAgo == 3) {
                    it("should return yellow", async () => {
                        const status = await checkStage2Status(startDaysAgo, numSegs, lumosData);
                        expect(status.status).toBe('yellow');
                        expect(status.lumosity).toBe('yellow');
                        expect(status.breathing).toBe(exp);
                    });
                } else {
                    it("should return red", async () => {
                        const status = await checkStage2Status(startDaysAgo, numSegs, lumosData);
                        expect(status.status).toBe('red');
                        expect(status.lumosity).toBe('red');
                        expect(status.breathing).toBe(exp);
                    });
                }
        });

    });

    describe("if the user has played 6 lumosity games/day 2 or 3 days in the last six days", () => {
        const lumosData = buildLumosityData(3);
        const nonRedConds = stage2BreathingConditions.filter(c => c.exp !== 'red');
        const redConds = stage2BreathingConditions.filter(c => c.exp === 'red');

        describe.each(nonRedConds)("if the user started $startDaysAgo days ago and has done $numSegs breathing segments",
            ({startDaysAgo, numSegs, exp}) => {
                if (startDaysAgo <= 3) {
                    it("should return the expected status", async () => {
                        const status = await checkStage2Status(startDaysAgo, numSegs, lumosData);
                        expect(status.status).toBe(exp);
                        expect(status.lumosity).toBe('green');
                        expect(status.breathing).toBe(exp);
                    });
                } else {
                    it("should return yellow", async () => {
                        const status = await checkStage2Status(startDaysAgo, numSegs, lumosData);
                        expect(status.status).toBe('yellow');
                        expect(status.lumosity).toBe('yellow');
                        expect(status.breathing).toBe(exp);
                    });
                }
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
    { startDaysAgo: 0, numSegsLast5Days: 1, exp: 'green'},
    { startDaysAgo: 2, numSegsLast5Days: 12, exp: 'green'},
    { startDaysAgo: 2, numSegsLast5Days: 6, exp: 'green'},
    { startDaysAgo: 3, numSegsLast5Days: 12, exp: 'green'},
    { startDaysAgo: 3, numSegsLast5Days: 6, exp: 'yellow'},
    { startDaysAgo: 4, numSegsLast5Days: 24, exp: 'green'},
    { startDaysAgo: 4, numSegsLast5Days: 18, exp: 'yellow'},
    { startDaysAgo: 4, numSegsLast5Days: 12, exp: 'red'},
    { startDaysAgo: 4, numSegsLast5Days: 6, exp: 'red'},
    { startDaysAgo: 5, numSegsLast5Days: 12, exp: 'red'},
    { startDaysAgo: 13, numSegsLast5Days: 20, exp: 'yellow'},
    { startDaysAgo: 18, numSegsLast5Days: 24, exp: 'green'},
    { startDaysAgo: 27, numSegsLast5Days: 17, exp: 'red'},
];

describe("stage 3 status", () => {

    describe("if the user has played 6 lumosity games/day 0 or 1 days in the last six days", () => {
        const lumosData = buildLumosityData(1);

        describe.each(stage3BreathingConditions)("if the user started $startDaysAgo days ago and has done $numSegsLast5Days breathing segments in the last 5 days",
            ({startDaysAgo, numSegsLast5Days, exp}) => {
                if (startDaysAgo <= 1) {
                    it("should return green", async () => {
                        const status = await checkStage3Status(startDaysAgo, numSegsLast5Days, lumosData);
                        expect(status.status).toBe('green');
                        expect(status.lumosity).toBe('green');
                        expect(status.breathing).toBe('green');
                    })
                } else if (startDaysAgo == 2 || startDaysAgo == 3) {
                    it("should return yellow", async () => {
                        const status = await checkStage3Status(startDaysAgo, numSegsLast5Days, lumosData);
                        expect(status.status).toBe('yellow');
                        expect(status.lumosity).toBe('yellow');
                        expect(status.breathing).toBe(exp);
                    });
                } else {
                    it("should return red", async () => {
                        const status = await checkStage3Status(startDaysAgo, numSegsLast5Days, lumosData);
                        expect(status.status).toBe('red');
                        expect(status.lumosity).toBe('red');
                        expect(status.breathing).toBe(exp);
                    });
                }
        });

    });

    describe("if the user has played 6 lumosity games/day 2 or 3 days in the last six days", () => {
        const lumosData = buildLumosityData(3);
        const nonRedConds = stage3BreathingConditions.filter(c => c.exp !== 'red');
        const redConds = stage3BreathingConditions.filter(c => c.exp === 'red');

        describe.each(nonRedConds)("if the user started $startDaysAgo days ago and has done $numSegsLast5Days breathing segments in the last 5 days",
            ({startDaysAgo, numSegsLast5Days, exp}) => {
                if (startDaysAgo <= 3) {
                    it("should return the expected status", async () => {
                        const status = await checkStage3Status(startDaysAgo, numSegsLast5Days, lumosData);
                        expect(status.status).toBe(exp);
                        expect(status.lumosity).toBe('green');
                        expect(status.breathing).toBe(exp);
                    });
                } else {
                    it("should return yellow", async () => {
                        const status = await checkStage3Status(startDaysAgo, numSegsLast5Days, lumosData);
                        expect(status.status).toBe('yellow');
                        expect(status.lumosity).toBe('yellow');
                        expect(status.breathing).toBe(exp);
                    });
                }
        });

        describe.each(redConds)("if the user started $startDaysAgo days ago and has done $numSegsLast5Days breathing segments in the last 5 days",
            ({startDaysAgo, numSegsLast5Days, exp}) => {
                it("should return red", async () => {
                    const status = await checkStage3Status(startDaysAgo, numSegsLast5Days, lumosData);
                    expect(status.status).toBe('red');
                    expect(status.lumosity).toBe('yellow');
                    expect(status.breathing).toBe(exp);
                });
        });
    });

    describe("if the user has played 6 lumosity games/day 4 or more days in the last six days", () => {
        const lumosData = buildLumosityData(4);

        describe.each(stage3BreathingConditions)("if the user started $startDaysAgo days ago and has done $numSegsLast5Days breathing segments  in the last 5 days it should return $exp",
            ({startDaysAgo, numSegsLast5Days, exp}) => {
                it("", async () => {
                    const status = await checkStage3Status(startDaysAgo, numSegsLast5Days, lumosData);
                    expect(status.status).toBe(exp);
                    expect(status.lumosity).toBe('green');
                    expect(status.breathing).toBe(exp);
                });
        });
    });
    
});

async function checkBaselineStatus(startHoursAgo, numSetsDone, expectedStatus) {
    const now = dayjs();
    const startDate = now.subtract(startHoursAgo, 'hours');
    const results = [];
    for (let i = 0; i < numSetsDone; i++) {
        results.push({experiment: 'set-finished'});
    }
    const status = await baselineStatus(mockDb(results, [], { startDate: startDate.format('YYYY-MM-DD') }), 'abc321');
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

async function checkStage3Status(startDaysAgo, numSegsLast5Days, lumosData) {
    const now = dayjs();
    const stage2CompletedDate = now.subtract(startDaysAgo, 'days').format("YYYYMMDD");
    const results = [];
    const fiveDaysAgo = now.subtract(5, 'days');
    const segGapSeconds = (5 * 24 * 60 * 60) / numSegsLast5Days;
    for (let j = 0; j < numSegsLast5Days; j++) {
        results.push({stage: 3, endDateTime: fiveDaysAgo.add(j * segGapSeconds, 'seconds').unix()});
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

async function checkLumosityStatus(numDaysWithSixPlays, expectedStatus, daysSinceStart) {
    const allPlays = buildLumosityData(numDaysWithSixPlays);
    const status = await lumosityStatus(mockDb([], allPlays), 'abc123', daysSinceStart);
    expect(status).toBe(expectedStatus);
}