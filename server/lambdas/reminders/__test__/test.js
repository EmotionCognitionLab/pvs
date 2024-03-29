'use strict';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

const path = require('path');
require('dotenv').config({path: path.join(__dirname, './env.sh')});
const studyAdminEmail = process.env.STUDY_ADMIN_EMAIL;

import { handler, forTesting } from '../reminders';

const { hasCompletedBaseline, hasDoneSetToday } = forTesting;
const preBaselineUser =  { userId: '123abc', humanId: 'BigIdea', email: 'nobody@example.com' };
const mockGetPreBaselineIncompleteUsers = jest.fn(() => [ preBaselineUser ]);
const mockGetHomeTrainingInProgressUsers = jest.fn(() => [ preBaselineUser ]);
const postBaselineUser = { userId: '789ghi', humanId: 'FunFull', email: 'nobodyelse@example.com', homeComplete: true };
const mockGetPostBaselineIncompleteUsers = jest.fn(() => [ postBaselineUser ]);
const mockGetResultsForCurrentUser = jest.fn(() => []);
const mockSegmentsForUser = jest.fn(() => []);
const mockGetBloodDrawUsers = jest.fn((yyyymmddStr) => []);
const identityId = '456def';
const mockGetSetsForUser = jest.fn(() => buildSets(3, 3));
const mockUpdateUser = jest.fn(() => {});
const mockGetUsersStartingOn = jest.fn((yyyyMMdd) => []);
const mockGetUser = jest.fn((userId) => []);
const mockLumosMultiPlays = jest.fn((startDate, endDate) => []);

const mockSendEmail = jest.fn(() => ({ promise: () => new Promise(resolve => resolve())}));
const mockSnsPublish = jest.fn(() => ({ promise: () => Promise.resolve() }));

const allMocks = [
    mockGetPreBaselineIncompleteUsers, mockGetPostBaselineIncompleteUsers, 
    mockGetHomeTrainingInProgressUsers, mockGetResultsForCurrentUser, 
    mockGetSetsForUser, mockSegmentsForUser, mockUpdateUser, 
    mockGetBloodDrawUsers, mockGetUsersStartingOn, mockSendEmail, mockSnsPublish,
    mockGetUser, mockLumosMultiPlays
];

jest.mock('aws-sdk/clients/ses', () => {
    return jest.fn().mockImplementation(() => {
        return {
            sendEmail: (params) => mockSendEmail(params)
        };
    });
});

jest.mock('aws-sdk/clients/sns', () => {
    return jest.fn().mockImplementation(() => {
        return {
            publish: (params) => mockSnsPublish(params)
        };
    });
});

jest.mock('db/db', () => {
    return jest.fn().mockImplementation(() => {
        return {
            getResultsForCurrentUser: (exp, ident) => mockGetResultsForCurrentUser(exp, ident),
            getBaselineIncompleteUsers: (baseType) => baseType === 'pre' ? mockGetPreBaselineIncompleteUsers(baseType) : mockGetPostBaselineIncompleteUsers(baseType),
            getSetsForUser: (userId) => mockGetSetsForUser(userId),
            updateUser: (userId, updates) => mockUpdateUser(userId, updates),
            getHomeTrainingInProgressUsers: () => mockGetHomeTrainingInProgressUsers(),
            segmentsForUser: (humanId, startDate, endDate) => mockSegmentsForUser(humanId, startDate, endDate),
            getBloodDrawUsers: (yyyymmddStr) => mockGetBloodDrawUsers(yyyymmddStr),
            getUsersStartingOn: (yyyyMMdd) => mockGetUsersStartingOn(yyyyMMdd),
            getUser: (userId) => mockGetUser(userId),
            lumosMultiPlays: (startDate, endDate) => mockLumosMultiPlays(startDate, endDate)
        };
    });
});

function buildSets(setStartedCount, setFinishedCount, startDate = new Date(Date.now() - (1000 * 60 * 60 * 24 * 5))) {
    const sets = [];
    if (setFinishedCount > setStartedCount) throw new Error("setFinishedCount must be <= setStartedCount");
    let date = startDate;
    for (let i=0; i < setStartedCount; i++) {
        sets.push({identityId: identityId, experiment: "set-started", dateTime: date.toISOString(), results: {setNum: i + 1}});
        date = new Date(date.getTime() + (Math.random() * (1000 * 60 * 60))); // add a random amount to the date (<=1 hr) to keep things moving forward
        if (i < setFinishedCount) {
            sets.push({identityId: identityId, experiment: "set-finished", dateTime: date.toISOString(), results: {setNum: i + 1}});
            date = new Date(date.getTime() + (Math.random()  * (1000 * 60 * 6)));
        }
    }
    return sets;
}

describe("reminders", () => {
    afterEach(() => {
        allMocks.forEach(mock => mock.mockClear());
    });

    it("should throw an error if no commType is provided", async () => {
        await expect(() => handler({reminderType: 'preBaseline'})).rejects.toEqual(Error("A commType of either 'email' or 'sms' was expected, but 'undefined' was received."));
    });

    it("should throw an error if an unexpected commType is provided", async () => {
        await expect(() => handler({commType: 'pigeon', reminderType: 'preBaseline'})).rejects.toEqual(Error("A commType of either 'email' or 'sms' was expected, but 'pigeon' was received."));
    });

    it("should throw an error if no reminderType is provided", async () => {
        await expect(() => handler({commType: 'email'})).rejects.toEqual(Error("A reminderType of either 'preBaseline' or 'homeTraining' was expected, but 'undefined' was received."));
    });

    it("should throw an error if an unexpected reminderType is provided", async () => {
        await expect(() => handler({commType: 'email', reminderType: 'make your bed'})).rejects.toEqual(Error("A reminderType of either 'preBaseline' or 'homeTraining' was expected, but 'make your bed' was received."));
    });

    it("should send an email when the commType is email", async () => {
        await handler({commType: 'email', reminderType: 'preBaseline'});
        expect(mockSendEmail).toHaveBeenCalled();
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).toStrictEqual([preBaselineUser.email]);
        expect(mockSnsPublish).not.toHaveBeenCalled();
    });

    it("should send an sms when the commType is sms", async () => {
        const phoneUser =  { userId: '123abc', email: 'nobody@example.com', phone_number: '+10123456789', phone_number_verified: true};
        mockGetPreBaselineIncompleteUsers.mockImplementationOnce(() => [phoneUser]);
        await handler({commType: 'sms', reminderType: 'preBaseline'});
        expect(mockSnsPublish).toHaveBeenCalled();
        expect(mockSnsPublish.mock.calls[0][0].PhoneNumber).toBe(phoneUser.phone_number);
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should not not send an sms to people whose phone numbers are not verified", async () => {
        const phoneUser =  { userId: '123abc', email: 'nobody@example.com', phone_number: '+10123456789', phone_number_verified: false};
        mockGetPreBaselineIncompleteUsers.mockImplementationOnce(() => [phoneUser]);
        await handler({commType: 'sms', reminderType: 'preBaseline'});
        expect(mockGetPreBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
        expect(mockGetSetsForUser).toHaveBeenCalledWith(preBaselineUser.userId);
        expect(mockSnsPublish).not.toHaveBeenCalled();
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should not send a reminder to someone who has dropped out", async () => {
        const droppedUser = { userId: '123abc', email: 'nobody@example.com', progress: { dropped: true }};
        mockGetPreBaselineIncompleteUsers.mockImplementationOnce(() => [droppedUser]);
        await handler({commType: 'email', reminderType: 'preBaseline'});
        expect(mockGetPreBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
        expect(mockGetSetsForUser).toHaveBeenCalledWith(droppedUser.userId);
        expect(mockSnsPublish).not.toHaveBeenCalled();
        expect(mockSendEmail).not.toHaveBeenCalled();
    });
});

describe("preBaseline reminders", () => {
    afterEach(() => {
        allMocks.forEach(mock => mock.mockClear());
    });

    describe("daily training reminders for people who have already completed the baseline", () => {
        const setsDone = buildSets(6,6);

        beforeEach(() => {
            mockGetResultsForCurrentUser.mockImplementationOnce(() => setsDone.filter(s => s.experiment === 'set-finished'));
            mockGetSetsForUser.mockImplementationOnce(() => setsDone);
        });

        it("should not be sent", async () => {
            await handler({commType: 'email', reminderType: 'preBaseline'});
            expect(mockGetPreBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
            expect(mockGetSetsForUser).toHaveBeenCalledWith(preBaselineUser.userId);
            expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
            expect(mockSendEmail).not.toHaveBeenCalled();
        });
    
        it("should update the db record for those people", async () => {
            await handler({commType: 'email', reminderType: 'preBaseline'});
            expect(mockGetPreBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
            expect(mockGetSetsForUser).toHaveBeenCalledWith(preBaselineUser.userId);
            expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
            expect(mockUpdateUser).toHaveBeenCalledWith(preBaselineUser.userId, { 'preComplete': true });
        });
    });

    it("should not remind someone whose start date is in the future", async () => {
        const lateStarter = Object.assign({}, preBaselineUser);
        lateStarter.startDate = dayjs().add(5, 'days').format('YYYY-MM-DD');
        mockGetPreBaselineIncompleteUsers.mockImplementationOnce(() => [lateStarter]);
        await handler({commType: 'email', reminderType: 'preBaseline'});
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should remind someone whose start date is in the past", async () => {
        const alreadyStarted = Object.assign({}, preBaselineUser);
        alreadyStarted.startDate = dayjs().subtract(5, 'days').format('YYYY-MM-DD');
        mockGetPreBaselineIncompleteUsers.mockImplementationOnce(() => [alreadyStarted]);
        await handler({commType: 'email', reminderType: 'preBaseline'});
        expect(mockSendEmail).toHaveBeenCalled();
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).toStrictEqual([alreadyStarted.email]);
    });

    it("should not remind people who have done a set today", async () => {
        const now = new Date();
        const past = dayjs(now).subtract(11, 'days').format('YYYY-MM-DD');
        mockGetSetsForUser.mockImplementationOnce(() => [ 
            { identityId: identityId, experiment: 'set-started', dateTime: now.toISOString() }, 
            { identityId: identityId, experiment: 'set-finished', dateTime: now.toISOString() }
        ].concat(Array(10).fill({identityId: identityId, experiment: 'set-started', dateTime: past})));
        
        await handler({commType: 'email', reminderType: 'preBaseline'});
        expect(mockGetPreBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
        expect(mockGetSetsForUser).toHaveBeenCalledWith(preBaselineUser.userId);
        expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
        expect(mockSendEmail).not.toHaveBeenCalled();
    });
});

describe("postBaseline reminders", () => {
    afterEach(() => {
        allMocks.forEach(mock => mock.mockClear());
    });

    describe("daily training reminders for people who have already completed the baseline", () => {
        const setsDone = buildSets(12,12);

        beforeEach(() => {
            mockGetResultsForCurrentUser.mockImplementationOnce(() => setsDone.filter(s => s.experiment === 'set-finished'));
            mockGetSetsForUser.mockImplementationOnce(() => setsDone);
        });

        it("should not be sent", async () => {
            await handler({commType: 'email', reminderType: 'postBaseline'});
            expect(mockGetPostBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
            expect(mockGetSetsForUser).toHaveBeenCalledWith(postBaselineUser.userId);
            expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
            // email notifying admins will be sent; reminder should not be
            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).not.toContain(postBaselineUser.email);
        });
    
        it("should update the db record for those people", async () => {
            await handler({commType: 'email', reminderType: 'postBaseline'});
            expect(mockGetPostBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
            expect(mockGetSetsForUser).toHaveBeenCalledWith(postBaselineUser.userId);
            expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
            expect(mockUpdateUser).toHaveBeenCalledWith(postBaselineUser.userId, { 'postComplete': true });
        });

        it("should tell admins who has finished", async () => {
            await handler({commType: 'email', reminderType: 'postBaseline'});
            expect(mockGetPostBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
            expect(mockGetSetsForUser).toHaveBeenCalledWith(postBaselineUser.userId);
            expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).toStrictEqual([studyAdminEmail]);
            const humIdRegEx = new RegExp(postBaselineUser.humanId);
            expect(mockSendEmail.mock.calls[0][0].Message.Body.Html.Data).toMatch(humIdRegEx);
        });
    });

    it("should not remind someone who has not completed the home training", async () => {
        expect(preBaselineUser.homeComplete).toBeFalsy();
        mockGetPostBaselineIncompleteUsers.mockImplementationOnce(() => [preBaselineUser]);
        await handler({commType: 'email', reminderType: 'postBaseline'});
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should remind someone who has completed the home training", async () => {
        await handler({commType: 'email', reminderType: 'postBaseline'});
        expect(mockSendEmail).toHaveBeenCalled();
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).toStrictEqual([postBaselineUser.email]);
    });

    it("should not remind people who have done a set today", async () => {
        const now = new Date();
        const past = dayjs(now).subtract(11, 'days').format('YYYY-MM-DD');
        const sets = buildSets(7, 7, new Date(Date.now() - (1000 * 60 * 60 * 24 * 7)))
        mockGetSetsForUser.mockImplementationOnce(() => sets.concat[ 
            { identityId: identityId, experiment: 'set-started', dateTime: now.toISOString() }, 
            { identityId: identityId, experiment: 'set-finished', dateTime: now.toISOString() }
        ]);
        
        await handler({commType: 'email', reminderType: 'postBaseline'});
        expect(mockGetPostBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
        expect(mockGetSetsForUser).toHaveBeenCalledWith(postBaselineUser.userId);
        expect(mockSendEmail).not.toHaveBeenCalled();
    });
});

describe("hasCompletedBaseline", () => {
    afterEach(() => {
        mockGetResultsForCurrentUser.mockClear();
    });

    it('should call getResultsForCurrentUser to get set-finished records for the identityId from the first set', async () => {
        mockGetResultsForCurrentUser.mockImplementationOnce(() => [{}, {}, {}]);
        const ident = '123abc';
        const res = await hasCompletedBaseline([ {identityId: ident }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ], 'pre');
        expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', ident);
    });

    it("should throw an error if the preOrPost param is not 'pre' and not 'post'", async () => {        
        await expect(hasCompletedBaseline([], 'foo')).rejects.toThrow("Expected preOrPost to be 'pre' or 'post', but got foo.");
    });

    describe("pre", () => {
        it("should return false if given fewer than 12 sets", async () => {
            const res = await hasCompletedBaseline([], 'pre');
            expect(res).toBeFalsy();
        });

        it('should return false if getResultsForCurrentUser returns fewer than six sets', async () => {
            mockGetResultsForCurrentUser.mockImplementationOnce(() => [{}, {}, {}]);
            const res = await hasCompletedBaseline([ {identityId: 'foo123' }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ], 'pre');
            expect(mockGetResultsForCurrentUser).toHaveBeenCalled();
            expect(res).toBeFalsy();
        });

        it('should return false if the sets returned by getResultsForCurrentUser are not 1-6', async () => {
            const sets = [1,2,3,4,7,8].map(setNum => ({results: { setNum: setNum }}));
            mockGetResultsForCurrentUser.mockImplementationOnce(() => sets);
            const res = await hasCompletedBaseline([ {identityId: 'foo123' }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ], 'pre');
            expect(mockGetResultsForCurrentUser).toHaveBeenCalled();
            expect(res).toBeFalsy();
        });

        it('should return true if the sets returned by getResultsForCurrentUser are 1-6', async () => {
            const sets = [1,2,3,4,5,6].map(setNum => ({results: { setNum: setNum }}));
            mockGetResultsForCurrentUser.mockImplementationOnce(() => sets);
            const res = await hasCompletedBaseline([ {identityId: 'foo123' }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ], 'pre');
            expect(mockGetResultsForCurrentUser).toHaveBeenCalled();
            expect(res).toBeTruthy;
        });
    });

    describe("post", () => {
        const testSets = Array(24).fill([]);
        testSets[0] = { identityId: 'foo123' };

        it("should return false if given fewer than 24 sets", async () => {
            const res = await hasCompletedBaseline(Array(13).fill([]), 'post');
            expect(res).toBeFalsy();
        });

        it('should return false if getResultsForCurrentUser returns fewer than six sets where setNum > 6', async () => {
            const sets = [1,2,3,4,5,6,7,8].map(setNum => ({results: { setNum: setNum }}));
            mockGetResultsForCurrentUser.mockImplementationOnce(() => sets);
            const res = await hasCompletedBaseline(testSets, 'post');
            expect(mockGetResultsForCurrentUser).toHaveBeenCalled();
            expect(res).toBeFalsy();
        });

        it('should return false if the sets > 6 returned by getResultsForCurrentUser are not 7-12', async () => {
            const sets = [1,2,3,4,7,8].map(setNum => ({results: { setNum: setNum }}));
            mockGetResultsForCurrentUser.mockImplementationOnce(() => sets);
            const res = await hasCompletedBaseline(testSets, 'post');
            expect(mockGetResultsForCurrentUser).toHaveBeenCalled();
            expect(res).toBeFalsy();
        });

        it('should return true if the sets > 6 returned by getResultsForCurrentUser are 7-12', async () => {
            const sets = [1,2,3,4,5,6,7,8,9,10,11,12].map(setNum => ({results: { setNum: setNum }}));
            mockGetResultsForCurrentUser.mockImplementationOnce(() => sets);
            const res = await hasCompletedBaseline(testSets, 'post');
            expect(mockGetResultsForCurrentUser).toHaveBeenCalled();
            expect(res).toBeTruthy;
        });
    });

});

describe('hasDoneSetToday', () => {
    const today = new Date().toISOString();
    const earlier = new Date(Date.now() - (1000 * 60 * 60 * 24 * 3)).toISOString();

    it('should return false if there is no set-started record', () => {
        const sets = [ { experiment: 'set-finished', dateTime: today }, { experiment: 'set-finished', dateTime: today } ];
        const res = hasDoneSetToday(sets);
        expect(res).toBeFalsy();
    });

    it("should return false if the set-started record does not have today's date", () => {
        const sets = [ { experiment: 'set-started', dateTime: earlier }, { experiment: 'set-finished', dateTime: today } ];
        const res = hasDoneSetToday(sets);
        expect(res).toBeFalsy();
    });

    it('should return false if there is no set-finished record', () => {
        const sets = [ { experiment: 'set-started', dateTime: today }, { experiment: 'set-started', dateTime: today } ];
        const res = hasDoneSetToday(sets);
        expect(res).toBeFalsy();
    });

    it("should return false if the set-finished record does not have today's date", () => {
        const sets = [ { experiment: 'set-started', dateTime: today }, { experiment: 'set-finished', dateTime: earlier } ];
        const res = hasDoneSetToday(sets);
        expect(res).toBeFalsy();
    });

    it('should return true if there is a set-started and a set-finished record for today', () => {
        const sets = [ { experiment: 'set-started', dateTime: today }, { experiment: 'set-finished', dateTime: today } ];
        const res = hasDoneSetToday(sets);
        expect(res).toBeTruthy();
    });

    it("should return false if the YYYY-MM-DD matches today but the fact that it's UTC means that it was really yesterday", () => {
        const yyyyMMdd = dayjs().tz('America/Los_Angeles').format('YYYY-MM-DD');
        const localYesterday = dayjs(`${yyyyMMdd}T02:03:45.678Z`).tz('America/Los_Angeles').toDate();  // UTC YMD of today, but time of 2:03AM means that it was really yesterday in LA
        const sets = [ { experiment: 'set-started', dateTime: localYesterday }, { experiment: 'set-finished', dateTime: localYesterday }];
        const res = hasDoneSetToday(sets);
        expect(res).toBeFalsy();
    });

    it("should return true if the YYYY-MM-DD matches tomorrow but the fact that it's UTC means that it was really today", () => {
        const tomorrow = new Date(Date.now() + (1000 * 60 * 60 * 24));
        const tomorrowYMD = dayjs(tomorrow).tz('America/Los_Angeles').format('YYYY-MM-DD');
        const localToday = dayjs(`${tomorrowYMD}T02:34:56.789Z`).tz('America/Los_Angeles').toDate(); // UTC YMD of tomorrow, but time of 2:34AM means that it was really today in LA
        const sets = [ { experiment: 'set-started', dateTime: localToday }, { experiment: 'set-finished', dateTime: localToday }];
        const res = hasDoneSetToday(sets);
        expect(res).toBeTruthy();
    });
});

describe("home training reminders", () => {

    afterEach(() => {
        mockSegmentsForUser.mockClear();
        mockGetHomeTrainingInProgressUsers.mockClear();
        mockSendEmail.mockClear();
        mockSnsPublish.mockClear();
    });

    it("should be sent if no segments have been done today", async () => {
        const phoneUser =  { userId: '123abc', humanId: 'BigText', email: 'nobody@example.com', phone_number: '+10123456789', phone_number_verified: true};
        mockGetHomeTrainingInProgressUsers.mockImplementationOnce(() => [phoneUser]);
        await handler({commType: 'sms', reminderType: 'homeTraining'});
        expect(mockGetHomeTrainingInProgressUsers).toHaveBeenCalledTimes(1);
        expect(mockSegmentsForUser.mock.calls[0][0]).toBe(phoneUser.humanId);
        expect(mockSegmentsForUser.mock.calls[0][1].toString().substring(0, 15)).toBe(dayjs().tz('America/Los_Angeles').toDate().toString().substring(0, 15));
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(mockSnsPublish).toHaveBeenCalled();
        expect(mockSnsPublish.mock.calls[0][0].PhoneNumber).toBe(phoneUser.phone_number)
    });

    async function testWithSegments(segments) {
        mockSegmentsForUser.mockImplementationOnce((hId, day) => segments);
        await handler({commType: 'email', reminderType: 'homeTraining'});
        expect(mockGetHomeTrainingInProgressUsers).toHaveBeenCalledTimes(1);
        expect(mockSegmentsForUser.mock.calls[0][0]).toBe(preBaselineUser.humanId);
        expect(mockSegmentsForUser.mock.calls[0][1].toString().substring(0, 15)).toBe(dayjs().tz('America/Los_Angeles').toDate().toString().substring(0, 15));
    }

    it("should not be sent if a stage 1 segment has been done today", async() => {
        await testWithSegments([{ stage: 1 }]);
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(mockSnsPublish).not.toHaveBeenCalled();
    });

    it("should not be sent if a stage 2 segment has been done today", async() => {
        await testWithSegments([{ stage: 2 }]);
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(mockSnsPublish).not.toHaveBeenCalled();
    });

    it("should not be sent if 6+ stage 3 segments have been done today", async() => {
        const segments = [0,1,2,3,4,5].map(() => ({ stage: 3 }));
        await testWithSegments(segments);
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(mockSnsPublish).not.toHaveBeenCalled();
    });

    it("should send a stage 3-specific reminder if <6 stage 3 segments have been done today", async () => {
        const segments = [0,1,2,3,4].map(() => ({ stage: 3 }));
        await testWithSegments(segments);
        expect(mockSendEmail).toHaveBeenCalled();
        expect(mockSendEmail.mock.calls[0][0].Message.Body.Html.Data).toMatch(/complete two 15-minute paced breathing exercises/);
        expect(mockSnsPublish).not.toHaveBeenCalled();
    });

    it("should not be sent if the participant has dropped out", async () => {
        const droppedUser =  { userId: '123abc', humanId: 'BigText', email: 'nobody@example.com', progress: { dropped: true }};
        mockGetHomeTrainingInProgressUsers.mockImplementationOnce(() => [droppedUser]);
        await handler({commType: 'email', reminderType: 'homeTraining'});
        expect(mockGetHomeTrainingInProgressUsers).toHaveBeenCalledTimes(1);
        expect(mockSegmentsForUser.mock.calls[0][0]).toBe(droppedUser.humanId);
        expect(mockSegmentsForUser.mock.calls[0][1].toString().substring(0, 15)).toBe(dayjs().tz('America/Los_Angeles').toDate().toString().substring(0, 15));
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(mockSnsPublish).not.toHaveBeenCalled();
    });
});

describe("blood draw surveys", () => {
    afterEach(() => {
        mockSendEmail.mockClear();
        mockSnsPublish.mockClear();
    });

    it("should request people whose blood was drawn yesterday", async() => {
        await handler({commType: 'email', reminderType: 'bloodDrawSurvey'});
        const expectedDate = dayjs().subtract(1, 'days').format('YYYY-MM-DD');
        expect(mockGetBloodDrawUsers).toHaveBeenCalledTimes(1);
        expect(mockGetBloodDrawUsers.mock.calls[0][0]).toBe(expectedDate);
    });

    it("should include the user's first name and humanId in the message", async() => {
        const user = {name: 'ivan ivanovich', humanId: 'BigBoot', email: 'ivani@example.com'};
        mockGetBloodDrawUsers.mockImplementationOnce(() => [user]);
        await handler({commType: 'email', reminderType: 'bloodDrawSurvey'});
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        const emailParams = mockSendEmail.mock.calls[0][0];
        expect(emailParams.Destination.ToAddresses[0]).toBe(user.email);
        const namePat = new RegExp(user.name.split(" ")[0]);
        const idPat = new RegExp(user.humanId);
        expect(emailParams.Message.Body.Html.Data).toMatch(namePat);
        expect(emailParams.Message.Body.Html.Data).toMatch(idPat);
        expect(emailParams.Message.Body.Text.Data).toMatch(namePat);
        expect(emailParams.Message.Body.Text.Data).toMatch(idPat);
    });
});

describe("start tomorrow reminders", () => {
    afterEach(() => {
        mockGetUsersStartingOn.mockClear();
        mockSendEmail.mockClear();
        mockSnsPublish.mockClear();
    });

    it("should query for users whose start date is tomorrow", async () => {
        await handler({commType: 'email', reminderType: 'startTomorrow'});
        expect(mockGetUsersStartingOn).toHaveBeenCalledTimes(1);
        const expectedDate = dayjs().tz('America/Los_Angeles').add(1, 'day').format('YYYY-MM-DD');
        expect(mockGetUsersStartingOn.mock.calls[0][0]).toBe(expectedDate);
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(mockSnsPublish).not.toHaveBeenCalled();
    });

    const users = [
        { email: 'good@example.com', phone_number: '+10123456789', phone_number_verified: true},
        { email: 'dropped@example.com', phone_number: '+00123456789', phone_number_verified: true, progress: { dropped: '2023-01-01:10:19:37.039Z'} },
        { email: 'unverified@example.com', phone_number: '+10023456789', phone_number_verified: false}
    ];

    it("email should not be sent if the participant has dropped out", async() => {
        mockGetUsersStartingOn.mockImplementationOnce(() => users);
        await handler({commType: 'email', reminderType: 'startTomorrow'});
        expect(mockSnsPublish).not.toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalledTimes(2);
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).not.toContain([users[1].email]);
    });

    it("sms should not be sent if the participant has dropped out or has an unverified phone number", async() => {
        mockGetUsersStartingOn.mockImplementationOnce(() => users);
        await handler({commType: 'sms', reminderType: 'startTomorrow'});
        expect(mockSendEmail).not.toHaveBeenCalled();
        expect(mockSnsPublish).toHaveBeenCalledTimes(1);
        expect(mockSnsPublish.mock.calls[0][0].PhoneNumber).toBe(users[0].phone_number);
    });
});

describe("don't play Lumosity more than 1x/day reminders", () => {
    afterEach(() => {
        mockSendEmail.mockClear();
        mockSnsPublish.mockClear();
        mockGetUser.mockClear();
        mockLumosMultiPlays.mockClear();
    });

    it("should query for Lumosity plays between start and end of day yesterday", async () => {
        await handler({commType: 'email', reminderType: 'noMultiLumos'});
        expect(mockLumosMultiPlays).toHaveBeenCalledTimes(1);
        expect(mockGetUser).not.toHaveBeenCalled();
        expect(mockSendEmail).not.toHaveBeenCalled();
        const yesterday = dayjs().tz('America/Los_Angeles').subtract(1, 'day');
        const yesterdayStart = yesterday.startOf('day').format('YYYY-MM-DD HH:mm:ss');
        const yesterdayEnd = yesterday.endOf('day').format('YYYY-MM-DD HH:mm:ss');
        expect(mockLumosMultiPlays.mock.calls[0][0]).toBe(yesterdayStart);
        expect(mockLumosMultiPlays.mock.calls[0][1]).toBe(yesterdayEnd);
    });

    it("should fetch email addresses for the users who have played more than 1x yesterday", async () => {
        const userId = 'abc123';
        mockLumosMultiPlays.mockImplementationOnce(() => [{userId: userId}]);
        await handler({commType: 'email', reminderType: 'noMultiLumos'});
        expect(mockLumosMultiPlays).toHaveBeenCalledTimes(1);
        expect(mockGetUser).toHaveBeenCalledTimes(1);
        expect(mockGetUser.mock.calls[0][0]).toBe(userId);
    });

    it("should email anyone who has played Lumosity more than 1x yesterday", async () => {
        const user = {userId: 'abc123', email: 'multiplayer@example.com'};
        mockLumosMultiPlays.mockImplementationOnce(() => [{userId: user.userId}]);
        mockGetUser.mockImplementationOnce(() => user);
        await handler({commType: 'email', reminderType: 'noMultiLumos'});
        expect(mockLumosMultiPlays).toHaveBeenCalledTimes(1);
        expect(mockGetUser).toHaveBeenCalledTimes(1);
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).toContain(user.email);
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses.length).toBe(1);
    });

    it("should throw an error for any commType other than email", async () => {
        await expect(() => handler({commType: 'sms', reminderType: 'noMultiLumos'})).rejects.toEqual(Error("There is no sms message type for 'noMultiLumos' messages."));
    });
});