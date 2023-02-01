'use strict';
import { signingDone, getSigningInfo } from "../docusign.js";
import { sqsClient } from "../aws-clients.js";

const mockSaveDsSigningInfo = jest.fn();
const mockGetDsSigningInfo = jest.fn();
jest.mock('db/db', () => {
    return jest.fn().mockImplementation(() => {
        return {
            getDsSigningInfo: (envelopeId) => mockGetDsSigningInfo(envelopeId),
            saveDsSigningInfo: (envelopeId, name, email) => mockSaveDsSigningInfo(envelopeId, name, email)
        };
    });
});

const mockSendMessage = jest.fn();
jest.mock("../aws-clients.js");
sqsClient.sendMessage = mockSendMessage;

const user = {
    envelopeId: "badcab",
    name: "Pat Nobody",
    email: "pnobody@example.com"
};

describe("signingDone", () => {

    afterEach(() => {
        mockSendMessage.mockClear();
        mockSaveDsSigningInfo.mockClear();
    });

    it("should return an error if the envelopeId is missing", async () => {
        const event = buildSigningDoneEvent(null, user.name, user.email);
        await testSigningDone(event, 400, "Malformed request", 0, 0);
    });

    it("should return an error if the name is missing", async () => {
        const event = buildSigningDoneEvent(user.envelopeId, null, user.email);
        await testSigningDone(event, 400, "Malformed request", 0, 0);
    });

    it("should return an error if the email is missing", async () => {
        const event = buildSigningDoneEvent(user.envelopeId, user.name, null);
        await testSigningDone(event, 400, "Malformed request", 0, 0);
    });

    it("should save the signing details to the database", async () => {
        const event = buildSigningDoneEvent(user.envelopeId, user.name, user.email);
        await testSigningDone(event, 302, null, 1, 1);
        expect(mockSaveDsSigningInfo.mock.calls[0][0]).toEqual(user.envelopeId);
        expect(mockSaveDsSigningInfo.mock.calls[0][1]).toEqual(user.name);
        expect(mockSaveDsSigningInfo.mock.calls[0][2]).toEqual(user.email);
    });

    it("should put a message into the SQS queue", async () => {
        const event = buildSigningDoneEvent(user.envelopeId, user.name, user.email);
        await testSigningDone(event, 302, null, 1, 1);
        expect(mockSendMessage.mock.calls[0][0].MessageBody).toEqual(JSON.stringify({
            envelopeId: user.envelopeId,
            email: user.email
        }));
    });
});

describe("getSigningInfo", () => {
    it("should return an error if the envelopeId is missing", async () => {
        const event = { queryStringParameters: {} };
        const res = await getSigningInfo(event);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual("Malformed request");
    });

    it("should return an error if the envelopeId is blank", async () => {
        const event = { queryStringParameters: { envelopeId: "   " } };
        const res = await getSigningInfo(event);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual("Malformed request");
    });

    it("should return the results with the given envelopeId", async () => {
        mockGetDsSigningInfo.mockResolvedValueOnce({ Items: [user] });
        const event = { queryStringParameters: { envelopeId: user.envelopeId }};
        const res = await getSigningInfo(event);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(JSON.stringify([user]));
    });
});

function buildSigningDoneEvent(envelopeId, name, email) {
    return {
        queryStringParameters: {
            envelopeId: envelopeId,
            name: name,
            email: email
        }
    };
}

async function testSigningDone(event, expectedStatus, expectedBody, expectedNumSendMessageCalls, expectedNumSaveCalls) {
    const res = await signingDone(event);
    expect(res.statusCode).toBe(expectedStatus);
    if (expectedBody) expect(res.body).toEqual(expectedBody);
    expect(mockSendMessage).toBeCalledTimes(expectedNumSendMessageCalls);
    expect(mockSaveDsSigningInfo).toBeCalledTimes(expectedNumSaveCalls);
}