
'use strict';
import { signUp, sendEmails } from "../register.js";
import { sesClient, cognitoClient } from "../aws-clients.js";

const mockSendEmail = jest.fn();
const mockCognitoSignUp = jest.fn();
const mockGetDsSigningInfo = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockSaveDsRegInstructionsSent = jest.fn();

jest.mock('db/db', () => {
    return jest.fn().mockImplementation(() => {
        return {
            getDsSigningInfo: (envelopeId) => mockGetDsSigningInfo(envelopeId),
            getUserByEmail: (email) => mockGetUserByEmail(email),
            saveDsRegInstructionsSent: (envelopeId) => mockSaveDsRegInstructionsSent(envelopeId)
        };
    });
});

jest.mock("../aws-clients.js");
sesClient.sendEmail = mockSendEmail;
cognitoClient.signUp = mockCognitoSignUp;

const user = {
    envelopeId: '123abc',
    email: 'somebody@example.com',
    name: "Ivan Ivanovich"
};

const user2 = {
    envelopeId: "poe1",
    email: "nobody@example.com",
    name: "Nobody"
};

describe("signUp", () => {
    beforeAll(() => {
        mockGetDsSigningInfo.mockResolvedValue({Items: [{name: user.name, email: user.email}]});
        mockGetUserByEmail.mockResolvedValue({name: user.name});
    });

    afterEach(() => mockCognitoSignUp.mockClear());

    it("should return an error if there is no envelopeId", async() => {
        const event = buildSignUpEvent(null, "+12125551234", "twelvechars!!");
        await testSignUp(event, 400, "One or more required parameters are missing.", 0);
    });

    it("should return an error if there is no phone number", async() => {
        const event = buildSignUpEvent(user.envelopeId, null, "twelvechars!!");
        await testSignUp(event, 400, "One or more required parameters are missing.", 0);
    });

    it("should return an error if there is no password", async() => {
        const event = buildSignUpEvent(user.envelopeId,  "+12125551234", null);
        await testSignUp(event, 400, "One or more required parameters are missing.", 0);
    });

    it("should return an error if the password is less than 12 characters long", async() => {
        const event = buildSignUpEvent(user.envelopeId,  "+12125551234", "short-pass");
        await testSignUp(event, 400, "Password must be at least 12 characters.", 0);
    });

    it("should return an error if the phone number is not 12 characters long", async() => {
        const event = buildSignUpEvent(user.envelopeId,  "+1212555123", "twelvechars!!");
        await testSignUp(event, 400, "Phone number must be in the form +12135551212.", 0);
    });

    it("should return an error if the phone number does not begin with a plus sign", async() => {
        const event = buildSignUpEvent(user.envelopeId,  "991212555123", "twelvechars!!");
        await testSignUp(event, 400, "Phone number must be in the form +12135551212.", 0);
    });

    it("should return an error if the phone number does not match the pattern +1[\d]{10}", async() => {
        const event = buildSignUpEvent(user.envelopeId,  "+9121255512a", "twelvechars!!");
        await testSignUp(event, 400, "Phone number must be in the form +12135551212.", 0);
    });

    it("should return an error if no signed consent form is found for the given envelope id", async() => {
        mockGetDsSigningInfo.mockResolvedValueOnce({Items: []});
        const event = buildSignUpEvent(user.envelopeId,  "+12125551234", "twelvechars!!");
        await testSignUp(event, 500, `No consent signature found for envelope id ${user.envelopeId}.`, 0);
    });

    it("should sign the user up with cognito if everything is in order", async() => {
        const event = buildSignUpEvent(user.envelopeId, "+12125551234", "twelvechars!!");
        expect(mockGetDsSigningInfo).toHaveBeenCalled();
        expect(mockGetDsSigningInfo.mock.calls[0][0]).toEqual(user.envelopeId);
        await testSignUp(event, 200, JSON.stringify({status: "success"}), 1);
    });

});

describe("sendEmails", () => {
    beforeAll(() => {
        mockGetDsSigningInfo.mockResolvedValue({Items: [{name: user.name, email: user.email}]});
        mockGetUserByEmail.mockResolvedValue({});
    });

    afterEach(() => {
        mockGetDsSigningInfo.mockClear();
        mockGetUserByEmail.mockClear();
        mockSaveDsRegInstructionsSent.mockClear();
        mockSendEmail.mockClear();
    });

    it("should not send an email if the participant has already been emailed", async() => {
        mockGetDsSigningInfo.mockResolvedValueOnce({Items: [{name: user.name, email: user.email, emailed: "20220102"}]});
        const res = await sendEmails(sqsEvent);
        expect(res.batchItemFailures.length).toBe(0);
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should not send an email if the participant has already registered", async() => {
        mockGetUserByEmail.mockResolvedValueOnce({name: user.name});
        const res = await sendEmails(sqsEvent);
        expect(res.batchItemFailures.length).toBe(0);
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("should send an email if the participant has not already been emailed or registered", async() => {
        const res = await sendEmails(sqsEvent);
        expect(res.batchItemFailures.length).toBe(0);
        expect(mockSendEmail).toHaveBeenCalled();
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).toEqual([user.email]);
        const msgBodyRegEx = new RegExp(`.*${user.envelopeId}.*`);
        expect(mockSendEmail.mock.calls[0][0].Message.Body.Html.Data).toEqual(expect.stringMatching(msgBodyRegEx));
        expect(mockSendEmail.mock.calls[0][0].Message.Body.Text.Data).toEqual(expect.stringMatching(msgBodyRegEx));
    });

    it("should return the message id if it is unable to process the message", async() => {
        mockGetDsSigningInfo.mockRejectedValueOnce(new Error("This is a fake test error"));
        const res = await sendEmails(sqsEvent);
        expect(res.batchItemFailures.length).toBe(1);
        expect(res.batchItemFailures[0]).toEqual({itemIdentifier: sqsEvent.Records[0].messageId});
    });

    it("should process multiple participants if the SQS event has multiple records", async() => {
        mockGetDsSigningInfo.mockResolvedValueOnce({Items: [{name: user.name, email: user.email}]});
        mockGetDsSigningInfo.mockResolvedValueOnce({Items: [{name: user2.name, email: user2.email}]});
        const res = await sendEmails(multiRecordEvent);
        expect(res.batchItemFailures.length).toBe(0);
        expect(mockSendEmail).toHaveBeenCalledTimes(2);
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).toEqual([user.email]);
        expect(mockSendEmail.mock.calls[0][0].Message.Body.Html.Data).toEqual(expect.stringMatching(new RegExp(`.*${user.envelopeId}.*`)));
        expect(mockSendEmail.mock.calls[1][0].Destination.ToAddresses).toEqual([user2.email]);
        expect(mockSendEmail.mock.calls[1][0].Message.Body.Html.Data).toEqual(expect.stringMatching(new RegExp(`.*${user2.envelopeId}.*`)));
    });

    it("should process multiple participants even if there's a failure with one of them", async() => {
        mockGetDsSigningInfo.mockRejectedValueOnce(new Error("This is a fake test error"));
        mockGetDsSigningInfo.mockResolvedValueOnce({Items: [{name: user2.name, email: user2.email}]});
        const res = await sendEmails(multiRecordEvent);
        expect(res.batchItemFailures.length).toBe(1);
        expect(res.batchItemFailures[0]).toEqual({itemIdentifier: sqsEvent.Records[0].messageId});
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        expect(mockSendEmail.mock.calls[0][0].Destination.ToAddresses).toEqual([user2.email]);
        expect(mockSendEmail.mock.calls[0][0].Message.Body.Html.Data).toEqual(expect.stringMatching(new RegExp(`.*${user2.envelopeId}.*`)));
    });
});

const sqsEvent = {
    Records: [
        { messageId: '123abc', body: JSON.stringify({envelopeId: user.envelopeId, email: user.email})}
    ]
};

const multiRecordEvent = {
    Records: [
        sqsEvent.Records[0],
        { messageId: '345def', body: JSON.stringify({envelopeId: user2.envelopeId, email: user2.email})}
    ]
};

function buildSignUpEvent(envelopeId, phone, password) {
    return {
        body: JSON.stringify({
            envelopeId: envelopeId,
            phone: phone,
            password: password
        })
    };
}

async function testSignUp(event, expectedStatus, expectedError, expectedCognitoSignUpTimes) {
    const res = await signUp(event);
    expect(res.statusCode).toEqual(expectedStatus);
    expect(res.body).toBe(expectedError);
    expect(mockCognitoSignUp).toBeCalledTimes(expectedCognitoSignUpTimes);
}