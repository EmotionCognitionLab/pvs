'use strict';

import { format } from 'date-fns-tz';
import { handler, forTesting } from '../reminders';

const { hasCompletedBaseline, hasDoneSetToday } = forTesting;
const user =  { userId: '123abc', email: 'nobody@example.com' };
const mockGetBaselineIncompleteUsers = jest.fn(() => [ user ]);
const mockGetResultsForCurrentUser = jest.fn(() => []);
const identityId = '456def';
const mockGetSetsForUser = jest.fn(() => buildSets(3, 3));
const mockUpdateUser = jest.fn(() => {});

const mockSendEmail = jest.fn(() => ({ promise: () => new Promise(resolve => resolve())}));
const mockSnsPublish = jest.fn(() => ({ promise: () => Promise.resolve() }));

const allMocks = [mockGetBaselineIncompleteUsers, mockGetResultsForCurrentUser, mockGetSetsForUser, mockUpdateUser, mockSendEmail, mockSnsPublish];

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
            getBaselineIncompleteUsers: (baseType) => mockGetBaselineIncompleteUsers(baseType),
            getSetsForUser: (userId) => mockGetSetsForUser(userId),
            updateUser: (userId, updates) => mockUpdateUser(userId, updates)
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
        await expect(() => handler({})).rejects.toEqual(Error("A commType of either 'email' or 'sms' was expected, but 'undefined' was received."));
    });

    it("should throw an error if an unexpected commType is provided", async () => {
        await expect(() => handler({commType: 'pigeon'})).rejects.toEqual(Error("A commType of either 'email' or 'sms' was expected, but 'pigeon' was received."));
    });

    describe("for people who have already completed the baseline", () => {
        const setsDone = buildSets(6,6);

        beforeEach(() => {
            mockGetResultsForCurrentUser.mockImplementationOnce(() => setsDone.filter(s => s.experiment === 'set-finished'));
            mockGetSetsForUser.mockImplementationOnce(() => setsDone);
        });

        it("should not be sent", async () => {
            await handler({commType: 'email'});
            expect(mockGetBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
            expect(mockGetSetsForUser).toHaveBeenCalledWith(user.userId);
            expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
            expect(mockSendEmail).not.toHaveBeenCalled();
        });
    
        it("should update the db record for those people", async () => {
            await handler({commType: 'email'});
            expect(mockGetBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
            expect(mockGetSetsForUser).toHaveBeenCalledWith(user.userId);
            expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
            expect(mockUpdateUser).toHaveBeenCalledWith(user.userId, { 'preComplete': true });
        });
    });

    it("should not remind people who have done a set today", async () => {
        const now = new Date();
        const today = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, 0)}-${now.getDate().toString().padStart(2, 0)}`;
        mockGetSetsForUser.mockImplementationOnce(() => [ 
            { identityId: identityId, experiment: 'set-started', dateTime: today }, 
            { identityId: identityId, experiment: 'set-finished', dateTime: today }, 
            {}, {}, {}, {}, {}, {}, {}, {}, {}, {} 
        ]);
        
        await handler({commType: 'email'});
        expect(mockGetBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
        expect(mockGetSetsForUser).toHaveBeenCalledWith(user.userId);
        expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should send an email when the commType is email", async () => {
        await handler({commType: 'email'});
        expect(mockSendEmail).toHaveBeenCalled();
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).toStrictEqual([user.email]);
        expect(mockSnsPublish).not.toHaveBeenCalled();
    });

    it("should send an sms when the commType is sms", async () => {
        const phoneUser =  { userId: '123abc', email: 'nobody@example.com', phone_number: '+10123456789', phone_number_verified: true};
        mockGetBaselineIncompleteUsers.mockImplementationOnce(() => [phoneUser]);
        await handler({commType: 'sms'});
        expect(mockSnsPublish).toHaveBeenCalled();
        expect(mockSnsPublish.mock.calls[0][0].PhoneNumber).toBe(phoneUser.phone_number);
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should not not send an sms to people whose phone numbers are not verified", async () => {
        const phoneUser =  { userId: '123abc', email: 'nobody@example.com', phone_number: '+10123456789', phone_number_verified: false};
        mockGetBaselineIncompleteUsers.mockImplementationOnce(() => [phoneUser]);
        await handler({commType: 'sms'});
        expect(mockGetBaselineIncompleteUsers).toHaveBeenCalledTimes(1);
        expect(mockGetSetsForUser).toHaveBeenCalledWith(user.userId);
        expect(mockSnsPublish).not.toHaveBeenCalled();
        expect(mockSendEmail).not.toHaveBeenCalled();
    });
});

describe("hasCompletedBaseline", () => {
    afterEach(() => {
        mockGetResultsForCurrentUser.mockClear();
    });

    it("should return false if given fewer than 12 sets", async () => {
        const res = await hasCompletedBaseline([]);
        expect(res).toBeFalsy();
    });

    it('should call getResultsForCurrentUser to get set-finished records for the identityId from the first set', async () => {
        mockGetResultsForCurrentUser.mockImplementationOnce(() => [{}, {}, {}]);
        const ident = '123abc';
        const res = await hasCompletedBaseline([ {identityId: ident }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ]);
        expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', ident);
    });

    it('should return false if getResultsForCurrentUser returns fewer than six sets', async () => {
        mockGetResultsForCurrentUser.mockImplementationOnce(() => [{}, {}, {}]);
        const res = await hasCompletedBaseline([ {identityId: 'foo123' }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ]);
        expect(mockGetResultsForCurrentUser).toHaveBeenCalled();
        expect(res).toBeFalsy();
    });

    it('should return false if the sets returned by getResultsForCurrentUser are not 1-6', async () => {
        const sets = [1,2,3,4,7,8].map(setNum => ({results: { setNum: setNum }}));
        mockGetResultsForCurrentUser.mockImplementationOnce(() => sets);
        const res = await hasCompletedBaseline([ {identityId: 'foo123' }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ]);
        expect(mockGetResultsForCurrentUser).toHaveBeenCalled();
        expect(res).toBeFalsy();
    });

    it('should return true if the sets returned by getResultsForCurrentUser are 1-6', async () => {
        const sets = [1,2,3,4,5,6].map(setNum => ({results: { setNum: setNum }}));
        mockGetResultsForCurrentUser.mockImplementationOnce(() => sets);
        const res = await hasCompletedBaseline([ {identityId: 'foo123' }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ]);
        expect(mockGetResultsForCurrentUser).toHaveBeenCalled();
        expect(res).toBeTruthy;
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
        const yyyyMMdd = format(new Date(), 'yyyy-MM-dd', { timezone: 'America/Los_Angeles' });
        const localYesterday = new Date(`${yyyyMMdd}T02:03:45.678Z`); // UTC YMD of today, but time of 2:03AM means that it was really yesterday in LA
        const sets = [ { experiment: 'set-started', dateTime: localYesterday }, { experiment: 'set-finished', dateTime: localYesterday }];
        const res = hasDoneSetToday(sets);
        expect(res).toBeFalsy();
    });

    it("should return true if the YYYY-MM-DD matches tomorrow but the fact that it's UTC means that it was really today", () => {
        const tomorrow = new Date(Date.now() + (1000 * 60 * 60 * 24));
        const tomorrowYMD = format(tomorrow, 'yyyy-MM-dd', { timezone: 'America/Los_Angeles' });
        const localToday = new Date(`${tomorrowYMD}T02:34:56.789Z`); // UTC YMD of tomorrow, but time of 2:34AM means that it was really today in LA
        const sets = [ { experiment: 'set-started', dateTime: localToday }, { experiment: 'set-finished', dateTime: localToday }];
        const res = hasDoneSetToday(sets);
        expect(res).toBeTruthy();
    });
});