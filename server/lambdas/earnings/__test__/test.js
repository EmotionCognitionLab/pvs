'use strict';

import { handler } from "../earnings.js"
import { earningsTypes } from '../../../../common/types/types.js';
import dayjs from 'dayjs';

const mockGetBaselineCompleteUsers = jest.fn(() => []);
const mockEarningsForUser = jest.fn(() => []);
const mockLumosPlaysForUser = jest.fn(() => []);
const mockSaveEarnings = jest.fn(() => {});
const mockSegmentsForUser = jest.fn(() => []);
const mockGetSetsForUser = jest.fn((userId) => Array(12).fill({identityId: 0}));
const mockGetResultsForCurrentUser = jest.fn(() => []);

const allMocks = [mockGetBaselineCompleteUsers, mockEarningsForUser, mockLumosPlaysForUser, mockSaveEarnings, mockSegmentsForUser, mockGetSetsForUser, mockGetResultsForCurrentUser];

jest.mock('db/db', () => {
    return jest.fn().mockImplementation(() => {
        return {
            earningsForUser: (userId, earnType) => mockEarningsForUser(userId, earnType),
            getBaselineCompleteUsers: (baseType) => mockGetBaselineCompleteUsers(baseType),
            getSetsForUser: (userId) => mockGetSetsForUser(userId),
            lumosPlaysForUser: (userId) => mockLumosPlaysForUser(userId),
            saveEarnings: (userId, earningsType, dateDone) => mockSaveEarnings(userId, earningsType, dateDone),
            segmentsForUser: (humanId) => mockSegmentsForUser(humanId),
            getResultsForCurrentUser: (expName, identityId) => mockGetResultsForCurrentUser(expName, identityId)
        };
    });
});

const lumosGames = ['Memory Match', 'Color Match', 'Raindrops', 'Brain Shift', 'Familiar Faces', 'Pirate Passage', 'Ebb and Flow'];

describe("Earnings calculation", () => {
    afterEach(() => {
        allMocks.forEach(mock => mock.mockClear());
    });

    it("should continue with other users if an error is thrown on one user", async () => {
        const users = [
            {userId: 'sets-ok', preComplete: true},
            {userId: 'no-sets', preComplete: true}
        ];

        const sets = [
            {experiment: 'set-finished', results: {setNum: 6}, dateTime: '2022-10-11'}
        ];

        mockGetResultsForCurrentUser.mockImplementationOnce(() => sets);
        mockGetBaselineCompleteUsers.mockImplementationOnce(() => users);
        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(1);
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.PRE, sets[0].dateTime);
    });

    it("should save earnings for each lab visit", async () => {
        const users = [{userId: 'all-visits', progress: {
                visit1: "2022-01-01T13:09:18.221Z",
                visit2: "2022-02-01T13:09:18.221Z",
                visit3: "2022-03-01T13:09:18.221Z",
                visit4: "2022-04-01T13:09:18.221Z",
                visit5: "2022-05-01T13:09:18.221Z",
            },
            homeComplete: true,
            preComplete: true
        }];

        mockGetBaselineCompleteUsers.mockReturnValue(users);
        mockEarningsForUser.mockReturnValue([{}]); // just so we don't try to save pre-earnings; not essential but simplifies things
        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(Object.keys(users[0].progress).length);
        Object.keys(users[0].progress).forEach(v => {
            expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, v, users[0].progress[v].substring(0, 10));
        });    
    });

    const prePostUsers = [
        {userId: 'sets-ok'},
    ];

    describe.each([
        { type: earningsTypes.PRE, finalSetNum: 6 },
        { type: earningsTypes.POST, finalSetNum: 12 }]
        )("cognitive baseline earnings", ({type, finalSetNum}) => {

        prePostUsers[0]['preComplete'] = type === earningsTypes.PRE;
        prePostUsers[0]['postComplete'] = type === earningsTypes.POST;

        it(`should save ${type}- baseline earnings if the user has completed the cognitive baseline`, async () => {
            const sets = [
                {experiment: 'set-finished', results: {setNum: finalSetNum}, dateTime: '2022-10-11'}
            ];
    
            mockGetResultsForCurrentUser.mockReturnValue(sets);
            mockGetBaselineCompleteUsers.mockReturnValue(prePostUsers);
            // ensure that in post case call for pre- earnings returns something and call for post- earnings returns nothing
            // otherwise we'll try to save pre- earnings and fail b/c there isn't a set-finished record for the pre- baseline
            mockEarningsForUser.mockReturnValue([]);
            if (type === earningsTypes.POST) {
                mockEarningsForUser.mockReturnValueOnce( [{userId: prePostUsers[0].userId, type: earningsTypes.PRE, date: '2022-01-01', amount: 30}] );
            }
            await handler();
            expect(mockSaveEarnings).toHaveBeenCalledWith(prePostUsers[0].userId, type, sets[0].dateTime);
        });

        it(`should not save ${type}- baseline earnings if they have already been saved`, async () => {
            const sets = [
                {experiment: 'set-finished', results: {setNum: finalSetNum}, dateTime: '2022-10-11'}
            ];
    
            mockGetResultsForCurrentUser.mockReturnValue(sets);
            mockGetBaselineCompleteUsers.mockReturnValue(prePostUsers);
            mockEarningsForUser.mockImplementation((userId, earnType) => {
                if (earnType === earningsTypes.PRE) {
                    return {userId: prePostUsers[0].userId, type: earningsTypes.PRE, date: '2022-01-01', amount: 30};
                } else {
                    return {userId: prePostUsers[0].userId, type: earningsTypes.POST, date: '2022-03-01', amount: 30};
                }
            });
            
            await handler();
            expect(mockSaveEarnings).not.toHaveBeenCalled();
        });

        it(`should not save ${type}- baseline earnings if the user's sets don't show they have finished the baseline`, async () => {
            if (type === earningsTypes.PRE) {
                mockGetResultsForCurrentUser.mockReturnValue([]);
            } else {
                mockGetResultsForCurrentUser.mockReturnValue([
                    {experiment: 'set-finished', results: {setNum: 6}, dateTime: '2022-10-11'}
                ]);
            }

            mockGetBaselineCompleteUsers.mockReturnValue(prePostUsers);
            // ensure that in post case call for pre- earnings returns something and call for post- earnings returns nothing
            // otherwise we'll try to save pre- earnings and fail b/c there isn't a set-finished record for the pre- baseline
            mockEarningsForUser.mockReturnValue([]);
            if (type === earningsTypes.POST) {
                mockEarningsForUser.mockReturnValueOnce( [{userId: prePostUsers[0].userId, type: earningsTypes.PRE, date: '2022-01-01', amount: 30}] );
            }
            await handler();
            expect(mockSaveEarnings).not.toHaveBeenCalled();
        });
    });
});

describe("Lumosity bonuses", () => {
    const users = [
        {userId: '123abc', homeComplete: false, preComplete: true}
    ];

    beforeEach(() => {
        mockGetBaselineCompleteUsers.mockReturnValue(users);
    });

    afterEach(() => {
        allMocks.forEach(mock => mock.mockClear());
    });

    it("should be paid on Sundays to users who have played Lumosity games other than Penguin Pursuit and Word Bubbles >=7 days and whose average lpi over the past week is > their average lpi for all plays before this week", async () => {
        const testDate = new Date('2022-11-06 13:44:02');
        expect(testDate.getDay == 0);
        const lumosPlays = buildLumosPlaysForBonus(users[0].userId, testDate);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockReturnValue([{}]);
        jest.useFakeTimers().setSystemTime(testDate);

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_BONUS, dayjs(testDate).format('YYYY-MM-DD'));
    });

    it("should not be paid on non-Sundays", async () => {
        const testDate = new Date('2022-11-12 13:44:02');
        expect(testDate.getDay != 0);
        const lumosPlays = buildLumosPlaysForBonus(users[0].userId, testDate);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockReturnValue([{}]);
        jest.useFakeTimers().setSystemTime(testDate);

        await handler();
        expect(mockSaveEarnings).not.toHaveBeenCalled();
    });

    it("should not be paid if the average LPI of games played this week is <= the average LPI of all games played before this week", async () => {
        const testDate = new Date('2022-11-06 13:44:02');
        expect(testDate.getDay == 0);
        const lumosPlays = buildLumosPlaysForBonus(users[0].userId, testDate);
        // the last play is from the past week and
        // has an LPI higher than the average of other plays - reset it to be lower
        lumosPlays[lumosPlays.length - 1].lpi = 0;

        const weekAgo = dayjs(testDate).subtract(1, 'week').format('YYYY-MM-DD HH:mm:ss');
        const prevGames = lumosPlays.filter(lp => lp.dateTime < weekAgo);
        const thisWeekGames = lumosPlays.filter(lp => lp.dateTime >= weekAgo);
        expect(prevGames.length).toBeGreaterThan(0);
        expect(thisWeekGames.length).toBeGreaterThan(0);
        const prevAvg = prevGames.reduce((prev, cur) => prev + cur.lpi, 0) / prevGames.length;
        const curAvg = thisWeekGames.reduce((prev, cur) => prev + cur.lpi, 0) / thisWeekGames.length;
        expect(prevAvg).toBeGreaterThan(curAvg);

        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockReturnValue([{}]);
        jest.useFakeTimers().setSystemTime(testDate);

        await handler();
        expect(mockSaveEarnings).not.toHaveBeenCalled();
    });

    it("should not be paid when a user has played Lumosity <7 days", async () => {
        const testDate = new Date('2022-11-06 13:44:02');
        expect(testDate.getDay == 0);
        const lumosPlays = buildLumosPlaysForBonus(users[0].userId, testDate).slice(0, 3);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockReturnValue([{}]);
        jest.useFakeTimers().setSystemTime(testDate);

        await handler();
        expect(mockSaveEarnings).not.toHaveBeenCalled();
    });

    it("should not include Penguin Pursuit or Word Bubbles games when calculating Lumosity bonuses", async () => {
        const testDate = new Date('2022-11-06 13:44:02');
        expect(testDate.getDay == 0);
        const lumosPlays = [];
        for (let i=1; i<=lumosGames.length; i++) {
            const playDate = dayjs(testDate).subtract(1, 'month').add(i, 'days').format('YYYY-MM-DD HH:mm:ss');
            lumosPlays.push({userId: users[0].userId, dateTime: playDate, game: lumosGames[i-1] + " Web", lpi: 10});
        }
        const lastPlayDate = dayjs(testDate).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
        lumosPlays.push({userId: users[0].userId, dateTime: lastPlayDate, game: 'Penguin Pursuit Web', lpi: 15});

        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockReturnValue([{}]);
        jest.useFakeTimers().setSystemTime(testDate);

        await handler();
        expect(mockSaveEarnings).not.toHaveBeenCalled();

        lumosPlays[lumosPlays.length - 1].game = 'Word Bubbles Web';
        await handler();
        expect(mockSaveEarnings).not.toHaveBeenCalled();

        lumosPlays[lumosPlays.length - 1].game = 'Brain Shift Web';
        await handler();
        expect(mockSaveEarnings).toHaveBeenCalled();

    });

    it("should only include games played between 12:01AM 7 days ago and 11:59PM 1 day ago in the previous week calculation", async () => {
        const testDate = new Date('2022-11-06 13:44:02');
        expect(testDate.getDay == 0);
        const lumosPlays = buildLumosPlaysForBonus(users[0].userId, testDate);
        // this additional play is (a) outside the time boundary of the previous week and
        // (b), if included in the previous week's calculation will bring down the average 
        // LPI for this week so low that no bonus should be earned
        lumosPlays.push({userId: users[0].userId, dateTime: dayjs(testDate).hour(0).minute(10).format('YYYY-MM-DD HH:mm:ss'), lpi: 0});
        
        const weekAgoStart = dayjs(testDate).subtract(7, 'days').hour(0).minute(0).second(1);
        const weekAgoEnd = dayjs(testDate).subtract(1, 'day').hour(23).minute(59).second(59);
        const thisWeekGames = lumosPlays.filter(lp => 
            lp.dateTime >= weekAgoStart.format('YYYY-MM-DD HH:mm:ss') &&
            lp.dateTime < weekAgoEnd.format('YYYY-MM-DD HH:mm:ss')
        );
        const recentGames = lumosPlays.filter(lp => lp.dateTime >= weekAgoStart.format('YYYY-MM-DD HH:mm:ss'));
        const prevGames = lumosPlays.filter(lp => lp.dateTime < weekAgoStart.format('YYYY-MM-DD HH:mm:ss'));
        const thisWeekAvg = thisWeekGames.reduce((prev, cur) => prev + cur.lpi, 0) / thisWeekGames.length;
        const recentAvg = recentGames.reduce((prev, cur) => prev + cur.lpi, 0) / recentGames.length;
        const prevAvg = prevGames.reduce((prev, cur) => prev + cur.lpi, 0) / prevGames.length;
        expect(thisWeekAvg).toBeGreaterThan(prevAvg);
        expect(recentAvg).toBeLessThan(prevAvg);

        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockReturnValue([{}]);
        jest.useFakeTimers().setSystemTime(testDate);

        await handler();
        // we expect it to be called because we expect our extra lumos play to be exluded
        // and therefore for the average for this week to be high enough to get a bonus
        expect(mockSaveEarnings).toHaveBeenCalled();
    });
});

describe("Lumos + breathing 1 earnings", () => {
    const users = [
        {userId: '123abc', humanId: 'BigTest', homeComplete: false, preComplete: true, stage2Completed: false}
    ];

    beforeEach(() => {
        mockGetBaselineCompleteUsers.mockReturnValue(users);
    });

    afterEach(() => {
        allMocks.forEach(mock => mock.mockClear());
    });

    it("in stage 2, should pay for Lumosity plays on days with >=6 game plays and one rest segment following the Lumosity session", async () => {
        const testDate = new Date("2022-10-15 11:45:17");
        const lumosPlays = buildLumosPlaysForEarnings(users[0].userId, testDate);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [];
            return [{}];
        });

        const breathSegs = [
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate).add(2, 'hours').unix(),
                avgCoherence: 0.84,
                isRest: true,
                stage: 2
            }
        ];
        mockSegmentsForUser.mockReturnValue(breathSegs);

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_AND_BREATH_1, dayjs(testDate).format('YYYY-MM-DD'));

    });

    it("in stage 3, should pay for Lumosity plays on days with >=6 game plays and three breathing segments following the Lumosity session", async () => {
        const testDate = new Date("2022-10-15 11:45:17");
        const stage2CompletedDate = "20221012";
        const stage3Users = [Object.assign({}, users[0])];
        stage3Users[0].stage2Completed = true;
        stage3Users[0].stage2CompletedOn = stage2CompletedDate;
        mockGetBaselineCompleteUsers.mockReturnValue(stage3Users);

        
        const lumosPlays = buildLumosPlaysForEarnings(users[0].userId, testDate);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [];
            return [{}];
        });

        const breathSegs = [
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate).add(120, 'minutes').unix(),
                avgCoherence: 0.84,
                isRest: false,
                stage: 3
            },
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate).add(125, 'minutes').unix(),
                avgCoherence: 1.12,
                isRest: false,
                stage: 3
            },
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate).add(130, 'minutes').unix(),
                avgCoherence: 0.77,
                isRest: false,
                stage: 3
            }
        ];
        mockSegmentsForUser.mockReturnValue(breathSegs);

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_AND_BREATH_1, dayjs(testDate).format('YYYY-MM-DD'));

    });

    it("should not pay for Lumosity plays done before the last lumosity payment date", async() => {
        const testDate1 = new Date("2022-10-15 11:45:17");
        const lumosPlays1 = buildLumosPlaysForEarnings(users[0].userId, testDate1);
        const testDate2 = new Date("2022-10-16 07:39:33");
        const lumosPlays2 = buildLumosPlaysForEarnings(users[0].userId, testDate2);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays1.concat(lumosPlays2));
        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [
                {
                    userId: users[0].userId,
                    type: earningsTypes.LUMOS_AND_BREATH_1,
                    date: dayjs(testDate1).format('YYYY-MM-DD'),
                    amount: 1
                }
            ];
            return [{}];
        });

        const breathSegs = [
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate1).add(2, 'hours').unix(),
                avgCoherence: 0.84,
                isRest: true,
                stage: 2
            },
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate2).add(2, 'hours').unix(),
                avgCoherence: 0.84,
                isRest: true,
                stage: 2
            }
        ];
        mockSegmentsForUser.mockReturnValue(breathSegs);

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(1);
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_AND_BREATH_1, dayjs(testDate2).format("YYYY-MM-DD"));
    });

    it("should not pay for Lumosity plays on days with <6 game plays", async () => {
        const testDate1 = new Date("2022-10-15 11:45:17");
        const lumosPlays1 = buildLumosPlaysForEarnings(users[0].userId, testDate1);
        const testDate2 = new Date("2022-10-16 22:05:14")
        const lumosPlays2 = buildLumosPlaysForEarnings(users[0].userId, testDate2).slice(0, 3);
        mockLumosPlaysForUser.mockReturnValue(lumosPlays1.concat(lumosPlays2));

        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [];
            return [{}];
        });

        const breathSegs = [
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate1).add(2, 'hours').unix(),
                avgCoherence: 0.84,
                isRest: true,
                stage: 2
            },
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate2).add(2, 'hours').unix(),
                avgCoherence: 0.99,
                isRest: true,
                stage: 2
            }
        ];
        mockSegmentsForUser.mockReturnValue(breathSegs);

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(1);
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_AND_BREATH_1, dayjs(testDate1).format('YYYY-MM-DD'));

    });

    it("in stage 2, should not pay for Lumosity plays on days with >=6 game plays that are not followed by a rest segment", async () => {
        const testDate = new Date("2022-10-15 11:45:17");
        const lumosPlays = buildLumosPlaysForEarnings(users[0].userId, testDate);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [];
            return [{}];
        });

        mockSegmentsForUser.mockReturnValue([]);

        await handler();
        expect(mockSaveEarnings).not.toHaveBeenCalled();

    });

    it("in stage 3, should not pay for Lumosity plays on days with >=6 game plays that are not followed by three breathing segments", async () => {
        const testDate1 = new Date("2022-10-15 11:45:17");
        const stage2CompletedDate = "20220930";
        const stage3Users = [Object.assign({}, users[0])];
        stage3Users[0].stage2Completed = true;
        stage3Users[0].stage2CompletedOn = stage2CompletedDate;
        mockGetBaselineCompleteUsers.mockReturnValue(stage3Users);

        
        const lumosPlays1 = buildLumosPlaysForEarnings(users[0].userId, testDate1);
        const testDate2 = new Date("2022-10-16 18:15:33");
        const lumosPlays2 = buildLumosPlaysForEarnings(users[0].userId, testDate2);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays1.concat(lumosPlays2));
        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [];
            return [{}];
        });

        const breathSegs = [
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate1).add(120, 'minutes').unix(),
                avgCoherence: 0.84,
                isRest: false,
                stage: 3
            },
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate1).add(125, 'minutes').unix(),
                avgCoherence: 1.12,
                isRest: false,
                stage: 3
            },
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate1).add(130, 'minutes').unix(),
                avgCoherence: 0.77,
                isRest: false,
                stage: 3
            }
        ];
        mockSegmentsForUser.mockReturnValue(breathSegs);

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(1);
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_AND_BREATH_1, dayjs(testDate1).format('YYYY-MM-DD'));

    });

    it("should pay users who recently transitioned to stage 3 for doing 1 breath segment after six lumosity plays if those plays happened while the user was still in stage 2", async() => {
        const testDate = new Date("2022-10-14 11:45:17");
        const stage2CompletedDate = "20221015";
        const stage3Users = [Object.assign({}, users[0])];
        stage3Users[0].stage2Completed = true;
        stage3Users[0].stage2CompletedOn = stage2CompletedDate;
        mockGetBaselineCompleteUsers.mockReturnValue(stage3Users);

        
        const lumosPlays = buildLumosPlaysForEarnings(users[0].userId, testDate);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [];
            return [{}];
        });

        const breathSegs = [
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate).add(120, 'minutes').unix(),
                avgCoherence: 0.84,
                isRest: false,
                stage: 2
            },
        ];
        mockSegmentsForUser.mockReturnValue(breathSegs);

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_AND_BREATH_1, dayjs(testDate).format('YYYY-MM-DD'));

    });

    it("in stage 3, should pay for Lumosity plays on days with >= 6 game plays followed by three breathing segments if those segments are in a different UTC day but same PT day", async () => {
        const testDate1 = new Date("2022-10-15 11:45:17"); // UTC, b/c tests run in UTC
        const stage2CompletedDate = "20220930";
        const stage3Users = [Object.assign({}, users[0])];
        stage3Users[0].stage2Completed = true;
        stage3Users[0].stage2CompletedOn = stage2CompletedDate;
        mockGetBaselineCompleteUsers.mockReturnValue(stage3Users);

        
        const lumosPlays1 = buildLumosPlaysForEarnings(users[0].userId, testDate1);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays1);
        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [];
            return [{}];
        });

        const breathSegs = [
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate1).add(13, 'hours').unix(), // new day UTC, same day PT
                avgCoherence: 0.84,
                isRest: false,
                stage: 3
            },
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate1).add(13, 'hours').add(5, 'minutes').unix(),
                avgCoherence: 1.12,
                isRest: false,
                stage: 3
            },
            {
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate1).add(13, 'hours').add(10, 'minutes').unix(),
                avgCoherence: 0.77,
                isRest: false,
                stage: 3
            }
        ];
        mockSegmentsForUser.mockReturnValue(breathSegs);

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(1);
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_AND_BREATH_1, dayjs(testDate1).format('YYYY-MM-DD'));
    });
});

describe("Breathing 2 earnings", () => {
    afterEach(() => {
        allMocks.forEach(mock => mock.mockClear());
    });

    it("should pay an additional $2 in stage 3 if the user does six breathing segments after a Lumosity session", async () => {
        await confirmBreath2Earnings(new Date("2022-10-15 11:45:17"), "20221003")
    });

    it("should pay users a stage 3 breathing bonus if they meet the requirements and it is the same day that they transitioned to stage 3", async () => {
        const d = new Date('2022-10-15 11:45:17');
        await confirmBreath2Earnings(d, dayjs(d).format('YYYYMMDD'))
    });

    it("should pay an additional $2 in stage 3 if the user does six breathing segments spread across two UTC days but on same PT day after a Lumosity session", async () => {
        const testDate = new Date('2022-09-29 22:47:38'); // UTC b/c tests run in UTC

        const users = [{userId: 'def456', humanId: 'BigTest', preComplete: true, stage2Completed: true, stage2CompletedOn: "20220914"}];
        mockGetBaselineCompleteUsers.mockReturnValue(users);

        
        const lumosPlays = buildLumosPlaysForEarnings(users[0].userId, testDate);
        
        mockLumosPlaysForUser.mockReturnValue(lumosPlays);
        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [];
            return [{}];
        });

        const breathSegs = [];
        // spreads breathing segments across three hours, 
        // splitting them across two UTC days but keeping
        // them in the same PT day
        for (let min = 30; min <= 180; min += 30) { 
            breathSegs.push({
                humanId: users[0].humanId,
                endDateTime: dayjs(testDate).add(min, 'minutes').unix(),
                avgCoherence: 0.84,
                isRest: false,
                stage: 3
            });
        }

        mockSegmentsForUser.mockReturnValue(breathSegs);

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(2);
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_AND_BREATH_1, dayjs(testDate).format('YYYY-MM-DD'));
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.BREATH2, dayjs(testDate).format('YYYY-MM-DD'));

    });
       
});

async function confirmBreath2Earnings(testDate, stage2CompletedOn) {
    const users = [{userId: 'def456', humanId: 'BigTest', preComplete: true, stage2Completed: true, stage2CompletedOn: stage2CompletedOn}];
    mockGetBaselineCompleteUsers.mockReturnValue(users);

    
    const lumosPlays = buildLumosPlaysForEarnings(users[0].userId, testDate);
    
    mockLumosPlaysForUser.mockReturnValue(lumosPlays);
    mockEarningsForUser.mockImplementation((userId, earnType) => {
        if (earnType === earningsTypes.LUMOS_AND_BREATH_1) return [];
        return [{}];
    });

    const breathSegs = [
        {
            humanId: users[0].humanId,
            endDateTime: dayjs(testDate).add(120, 'minutes').unix(),
            avgCoherence: 0.84,
            isRest: false,
            stage: 3
        },
        {
            humanId: users[0].humanId,
            endDateTime: dayjs(testDate).add(125, 'minutes').unix(),
            avgCoherence: 1.12,
            isRest: false,
            stage: 3
        },
        {
            humanId: users[0].humanId,
            endDateTime: dayjs(testDate).add(130, 'minutes').unix(),
            avgCoherence: 0.77,
            isRest: false,
            stage: 3
        },
        {
            humanId: users[0].humanId,
            endDateTime: dayjs(testDate).add(135, 'minutes').unix(),
            avgCoherence: 0.77,
            isRest: false,
            stage: 3
        },
        {
            humanId: users[0].humanId,
            endDateTime: dayjs(testDate).add(140, 'minutes').unix(),
            avgCoherence: 0.77,
            isRest: false,
            stage: 3
        },
        {
            humanId: users[0].humanId,
            endDateTime: dayjs(testDate).add(145, 'minutes').unix(),
            avgCoherence: 0.77,
            isRest: false,
            stage: 3
        }
    ];
    mockSegmentsForUser.mockReturnValue(breathSegs);

    await handler();
    expect(mockSaveEarnings).toHaveBeenCalledTimes(2);
    expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.LUMOS_AND_BREATH_1, dayjs(testDate).format('YYYY-MM-DD'));
    expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.BREATH2, dayjs(testDate).format('YYYY-MM-DD'));
}

describe("Breathing bonuses", () => {
    const users = [
        {userId: 'breathbonus', humanId: 'BigTest', homeComplete: false, preComplete: true, stage2Completed: true, stage2CompletedOn: "20000101"}
    ];

    beforeEach(() => {
        mockGetBaselineCompleteUsers.mockReturnValue(users);
        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.BREATH_BONUS) return [];
            return [{}];
        });
    });

    afterEach(() => {
        allMocks.forEach(mock => mock.mockClear());
    });

    it("should not be paid to users who have not done at least 9 stage 3 breathing segments", async () => {
        const testDate = new Date("2022-11-01 11:09:48");
        const breathSegs = buildBreathSegmentsForBonus(users[0].humanId, testDate);

        mockSegmentsForUser.mockReturnValue(breathSegs);
        await handler();
        expect(mockSaveEarnings).not.toHaveBeenCalled();
    });

    it("should not consider stage 2 segments in the bonus calculation", async () => {
        const testDate1 = new Date("2022-11-01 11:09:48");
        const breathSegs1 = buildBreathSegmentsForBonus(users[0].humanId, testDate1);

        const testDate2 = new Date("2022-11-02: 09:55:03");
        const breathSegs2 = buildBreathSegmentsForBonus(users[0].humanId, testDate2);
        expect(breathSegs1.length + breathSegs2.length).toBe(12);
        for (let i=0; i<4; i++) {
            breathSegs1[i].stage = 2;
            breathSegs1[i].isRest = true;
        }
        const allSegs = breathSegs1.concat(breathSegs2);
        expect(allSegs.filter(s => s.stage == 3).length).toBe(8);

        mockSegmentsForUser.mockReturnValue(allSegs);
        await handler();
        expect(mockSaveEarnings).not.toHaveBeenCalled();
    });

    it("should not include days with fewer than six segments", async () => {
        const startDate = new Date("2022-11-03 14:23:09");
        const testDates = [dayjs(startDate).toDate(), dayjs(startDate).add(1, 'days').toDate(), dayjs(startDate).add(2, 'days').toDate()];
        const breathSegsArr = testDates.map(td => buildBreathSegmentsForBonus(users[0].humanId, td));
        breathSegsArr[1].forEach(bs => bs.avgCoherence = 10);
        breathSegsArr[2] = breathSegsArr[2].slice(0, 3);
        mockSegmentsForUser.mockReturnValue(breathSegsArr.flatMap(a => a));

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(1);
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.BREATH_BONUS, dayjs(testDates[1]).format('YYYY-MM-DD'));
    });

    it("should not include dates before the last breath bonus date", async () => {
        const startDate = new Date("2022-11-03 14:23:09");
        const testDates = [dayjs(startDate).toDate(), dayjs(startDate).add(1, 'days').toDate(), dayjs(startDate).add(2, 'days').toDate()];
        const breathSegsArr = testDates.map(td => buildBreathSegmentsForBonus(users[0].humanId, td));
        breathSegsArr[2].forEach(bs => bs.avgCoherence = 10);
        mockSegmentsForUser.mockReturnValue(breathSegsArr.flatMap(a => a));

        mockEarningsForUser.mockImplementation((userId, earnType) => {
            if (earnType === earningsTypes.BREATH_BONUS) return [
                {
                    userId: users[0].userId,
                    type: earningsTypes.BREATH_BONUS,
                    date: dayjs(testDates[1]).format('YYYY-MM-DD'),
                    amount: 1
                }
            ];
            return [{}];
        });

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(1);
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.BREATH_BONUS, dayjs(testDates[2]).format('YYYY-MM-DD'));
    });

    it("should be paid for days with 6+ breathing segments where the average score is higher than the median score for all previous segments", async () => {
        const testDate1 = new Date("2022-11-03 14:23:09");
        const breathSegs1 = buildBreathSegmentsForBonus(users[0].humanId, testDate1, 1.02);
        const testDate2 = new Date("2022-11-04 08:22:01");
        const breathSegs2 = buildBreathSegmentsForBonus(users[0].humanId, testDate2, 1.11);

        mockSegmentsForUser.mockReturnValue(breathSegs1.concat(breathSegs2));

        await handler();
        expect(mockSaveEarnings).toHaveBeenCalledTimes(1);
        expect(mockSaveEarnings).toHaveBeenCalledWith(users[0].userId, earningsTypes.BREATH_BONUS, dayjs(testDate2).format('YYYY-MM-DD'));
    });

    it("should not be paid for days with 6+ breathing segments where the average score is <= the median score for all previous segments", async () => {
        const testDate1 = new Date("2022-11-03 14:23:09");
        const breathSegs1 = buildBreathSegmentsForBonus(users[0].humanId, testDate1, 1.27);
        const testDate2 = new Date("2022-11-04 08:22:01");
        const breathSegs2 = buildBreathSegmentsForBonus(users[0].humanId, testDate2, 0.89);

        mockSegmentsForUser.mockReturnValue(breathSegs1.concat(breathSegs2));

        await handler();
        expect(mockSaveEarnings).not.toHaveBeenCalled();    
    });

});

function buildLumosPlaysForBonus(userId, testDate) {
    const lumosPlays = buildLumosPlays(lumosGames, dayjs(testDate).subtract(1, 'month').toDate(), userId, 1, 'days');
    const lastPlayDate = dayjs(testDate).subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
    lumosPlays.push({userId: userId, dateTime: lastPlayDate, game: 'Memory Match', lpi: 15});

    return lumosPlays;
}

function buildLumosPlaysForEarnings(userId, testDate) {
    const lumosPlays = buildLumosPlays(lumosGames, testDate, userId, 10, 'minutes');
    return lumosPlays;
}

function buildLumosPlays(games, startDate, userId, interGameIntervalAmount, interGameIntervalUnit) {
    const lumosPlays = [];
    for (let i=1; i<=games.length; i++) {
        const playDate = dayjs(startDate).add(i * interGameIntervalAmount, interGameIntervalUnit).format('YYYY-MM-DD HH:mm:ss');
        lumosPlays.push({userId: userId, dateTime: playDate, game: games[i-1] + " Web", lpi: 10});
    }
    return lumosPlays;
}

function buildBreathSegmentsForBonus(humanId, startDate, avgCoherence = 1.02) {
    const breathSegs = [];
    for (let i=0; i<6; i++) {
        breathSegs.push({
            humanId: humanId,
            endDateTime: dayjs(startDate).add(i * 5, 'minutes').unix(),
            avgCoherence: avgCoherence,
            isRest: false,
            stage: 3
        });
    }
    return breathSegs;
}
