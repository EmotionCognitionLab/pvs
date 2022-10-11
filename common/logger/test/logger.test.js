import CloudWatchLogs from 'aws-sdk/clients/cloudwatchlogs';
import awsSettings from '../../aws-settings.json';
import { Logger } from "../logger.js";
import util from 'util';

function logStreamName() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

let mockCreateLogStream = jest.fn((params, callback) => callback(null, null));
const nextSequenceToken = 'ABC123';
let mockPutLogEvents = jest.fn((params, callback) => callback(null, {nextSequenceToken: nextSequenceToken}));
let mockDescribeLogStreams = jest.fn((params, callback) => callback(null, {logStreams: [{logStreamName: logStreamName(), uploadSequenceToken: nextSequenceToken}]}))

jest.mock('aws-sdk/clients/cloudwatchlogs', () => {
    return jest.fn().mockImplementation(() => {
        return {
            createLogStream: mockCreateLogStream,
            describeLogStreams: mockDescribeLogStreams,
            putLogEvents: mockPutLogEvents
        };
    });
});

describe("Logger", () => {
    let origStorage;
    let l;
    let localStorageMock;
    const localStorage = {};

    beforeEach(() => {
        jest.useFakeTimers("legacy");
        localStorageMock = {
            getItem: jest.fn((key) => localStorage[key]),
            setItem: jest.fn((key, item) => localStorage[key] = item)
        };
        origStorage = global.localStorage;
        global.localStorage = localStorageMock;
        l = new Logger();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        for (let key in localStorage) delete localStorage[key];
        localStorageMock.getItem.mockClear();
        localStorageMock.setItem.mockClear();
        global.localStorage = origStorage;
        mockCreateLogStream.mockClear();
        mockPutLogEvents.mockClear();
        mockDescribeLogStreams.mockClear();
    });

    it("should override console .log, .info, .warn and .error by default", () => {
        const logMock = jest.fn();
        l.storeLogMsg = logMock;
        ["log", "info", "warn", "error"].forEach(level => {
            const msg = `Testing console.${level} to ensure it is overridden`;
            console[level](msg);
            expect(logMock.mock.calls.length).toBe(1);
            expect(logMock.mock.calls[0][1]).toBe(level);
            logMock.mockClear();
        });
    });

    it("should not override console .log, .info, .warn and .error when override is false", () => {
        const noOverride = new Logger(false);
        const logMock = jest.fn();
        noOverride.storeLogMsg = logMock;
        ["log", "info", "warn", "error"].forEach(level => {
            const msg = `Testing console.${level} to ensure it is NOT overridden`;
            console[level](msg);
            expect(logMock.mock.calls.length).toBe(0);
            logMock.mockClear();
        });
    });

    it("should create a log stream named using today's date", () => {
        expect(mockCreateLogStream.mock.calls.length).toBe(1);
        const today = logStreamName();
        expect(mockCreateLogStream.mock.calls[0][0]).toStrictEqual({logGroupName: awsSettings.CloudwatchLogGroup, logStreamName: today});
    });

    it("should save the log stream name to local storage", () => {
        expect(localStorageMock.setItem.mock.calls.length).toBe(1);
        const streamName = logStreamName();
        expect(localStorageMock.setItem.mock.calls[0][1]).toBe(streamName);
    });

    it("should write all log events to cloudwatch every pushFrequncy milliseconds", () => {
        const logMsg = "A log call";
        const errorMsg = "An error call";
        console.log(logMsg);
        console.error(errorMsg);
        jest.advanceTimersByTime(l.pushFrequency);
        expect(mockPutLogEvents.mock.calls.length).toBe(1);
        const messages = mockPutLogEvents.mock.calls[0][0].logEvents.map(le => le.message);
        expect(messages).toContain(JSON.stringify({message: logMsg + " \n", level: "log", user: "unknown"}));
        expect(messages).toContain(JSON.stringify({message: errorMsg + " \n", level: "error", user: "unknown"}));
    });

    it("should log user information if provided", () => {
        const userId = "some-user-id";
        const userLogger = new Logger(false, userId);
        const logMsg = "I am logging from a user";
        userLogger.log(logMsg);
        const message = userLogger.logEntries[0].message;
        expect(message).toContain(JSON.stringify({message: logMsg + " \n", level: "log", user: userId}));
    });

    describe("with mocked Date.now", () => {
        let dateSpy;
        const now = Date.now();
        const mockDate = new Date(now + 24 * 60 * 60 * 1000);
        let origDateNowFn;

        beforeEach(() => {
            origDateNowFn = Date.now;
            dateSpy = jest.spyOn(global, "Date").mockImplementation(() => mockDate);
            Date.now = jest.fn(() => now + 24 * 60 * 60 * 1000);
        });

        afterEach(() => {
            dateSpy.mockRestore();
            Date.now = origDateNowFn;
        });

        it("should create a new log stream when attempting to log something on a new day", () => {
            jest.advanceTimersByTime(l.pushFrequency);
            expect(mockCreateLogStream.mock.calls.length).toBe(2);
            expect(mockCreateLogStream.mock.calls[1][0].logStreamName).toBe(logStreamName());
        });
    });

    it("should call describeLogStreams before pushing to cloudwatch and use the token returned when pushing", () => {
        console.log("Confirming call to describeLogStreams");
        jest.advanceTimersByTime(l.pushFrequency);
        expect(mockDescribeLogStreams.mock.calls.length).toBe(1);
        expect(mockDescribeLogStreams.mock.calls[0][0].logStreamNamePrefix).toBe(logStreamName());
        expect(mockPutLogEvents.mock.calls.length).toBe(1);
        expect(mockPutLogEvents.mock.calls[0][0].sequenceToken).toBe(nextSequenceToken); // TODO make this less brittle; could break if someone changes mockDescribeLogStreams definition
    });

    describe("with error on putLogEvents", () => {
        const putLogError = {
            code: "SomeRandomException",
            message: `Insert obscure error code here: CDE-123-ABC-789`
        };
        let mockError;

        beforeEach(() => {
            mockPutLogEvents
                .mockImplementationOnce((params, callback) => callback(putLogError, null));
            jest.clearAllTimers();
            mockError = jest.spyOn(console, "error");
        });

        afterEach(() => {
            mockError.mockReset();
        });

        it("should write log events on the second try if the first one fails", () => {
            const altLogger = new Logger();
            const msg1 = "checking log event writing, take 1";
            console.log(msg1);
            jest.advanceTimersByTime(altLogger.pushFrequency);
            const msg2 = "checking log event writing, take 2";
            console.log(msg2);
            jest.advanceTimersByTime(altLogger.pushFrequency);
            expect(mockPutLogEvents.mock.calls.length).toBe(2);
            const messages = mockPutLogEvents.mock.calls[1][0].logEvents.map(le => le.message);
            expect(messages).toContain(JSON.stringify({message: msg1 + " \n", level: "log", user: "unknown"}));
            expect(messages).toContain(JSON.stringify({message: msg2 + " \n", level: "log", user: "unknown"}));
        });
    
        it("should call console.error on a logging failure when override is false", () => {
            const altLogger = new Logger(false);
            const msg1 = "checking log event writing, take 1";
            altLogger.log(msg1);
            jest.advanceTimersByTime(altLogger.pushFrequency);
            expect(mockError.mock.calls.length).toBe(1);
            expect(mockError.mock.calls[0][0]).toBe("Error calling putLogEvents");
            expect(mockError.mock.calls[0][1]).toStrictEqual(putLogError);
            mockError.mockReset();
        });
    
        it("should not call console.error on a logging failure when override is true", () => {
            const altLogger = new Logger(true);
            const msg1 = "checking log event writing, take 1";
            altLogger.log(msg1);
            jest.advanceTimersByTime(altLogger.pushFrequency);
            expect(mockError.mock.calls.length).toBe(0);
            mockError.mockReset();
        });
    });
});
