'use strict';

import { handler, forTesting } from '../reminders';

const { hasCompletedBaseline, hasDoneSetToday } = forTesting;
const user =  { userId: '123abc', email: 'nobody@example.com' };
const mockGetBaselineIncompleteUsers = jest.fn(() => [ user ]);
const mockGetResultsForCurrentUser = jest.fn(() => []);
const identityId = '456def';
const mockGetSetsForUser = jest.fn(() => [ { identityId: identityId }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ]);
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
        const setsDone = [1,2,3,4,5,6].map(setNum => ({results: { setNum: setNum }}));

        beforeEach(() => {
            mockGetResultsForCurrentUser.mockImplementationOnce(() => setsDone);
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
        const today = new Date().toISOString();
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
        expect(mockGetResultsForCurrentUser).toHaveBeenCalledWith('set-finished', identityId);
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
    const earlier = new Date('1980-11-02').toISOString();

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
});