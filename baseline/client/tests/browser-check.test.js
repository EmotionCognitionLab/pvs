require("@adp-psych/jspsych/jspsych.js");
import { browserCheck, forTesting } from "../browser-check/browser-check";
import { clickContinue } from "./utils";
import ApiClient from "../../../common/api/client.js";
jest.mock("../../../common/api/client.js");
const uaParser = require("ua-parser-js");

describe("browser check if computer profile is not saved", () => {
    let buttons;
    let uaSpy = jest.spyOn(window.navigator, "userAgent", "get").mockImplementation(() => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36");
    let callback;

    beforeEach(async () => {
        window.localStorage.clear();
        callback = jest.fn();
        await browserCheck.run(callback, null);
        buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
    });

    afterEach(() => {
        ApiClient.mockClear();
        callback.mockClear();
        uaSpy.mockRestore();
    });

    it("should ask the user if this is their permanent computer", () => {
        expect(buttons[0].innerHTML).toBe("No");
        expect(buttons[1].innerHTML).toBe("Yes");
        // unfortunately b/c the stimulus text is loaded from a file jest replaces it, so
        // this is about all we can test
    });

    it("should save the computer profile if the user says this is their permanent computer", () => {
        buttons[1].click();
        const mockApiClientInstance = ApiClient.mock.instances[0];
        const mockUpdateSelf = mockApiClientInstance.updateSelf;
        expect(mockUpdateSelf).toHaveBeenCalled();
        expect(mockUpdateSelf.mock.calls[0][0].computer).not.toBe(null);
        const data = mockUpdateSelf.mock.calls[0][0].computer;
        expect(data[forTesting.uaKey]).toBe(window.navigator.userAgent);
        expect(data[forTesting.platformKey]).toBe(window.navigator.platform);
        const uaInfo = uaParser(window.navigator.userAgent);
        expect(data[forTesting.browserNameKey]).toBe(uaInfo.browser.name);
        expect(data[forTesting.osNameKey]).toBe(uaInfo.os.name);
        expect(data[browserCheck.screenSizeKey]).toBe(`${screen.width}x${screen.height}`);
    });

    it("should not save the computer profile if the user says this is not their permanent computer", () => {
        buttons[0].click();
        const mockApiClientInstance = ApiClient.mock.instances[0];
        const mockUpdateSelf = mockApiClientInstance.updateSelf;
        expect(mockUpdateSelf).not.toHaveBeenCalled();
    });

    it("should not call the callback if the user says this is not their permanent computer", () => {
        buttons[0].click();
        expect(callback.mock.calls.length).toBe(0);        
    });

    it("should call the provided callback once the user says they're ready to start", () => {
        buttons[1].click();
        clickContinue();
        expect(callback.mock.calls.length).toBe(1);
    });

    it("should save a flag in local storage letting us know that this is not a first-time user", async () => {
        expect(window.localStorage.getItem(`${browserCheck.appName}.${browserCheck.initKey}`)).toBeNull();
        buttons[1].click();
        await clickContinue();
        expect(window.localStorage.getItem(`${browserCheck.appName}.${browserCheck.initKey}`)).toBeTruthy();
    });
});

describe("browser check if user agent info is saved", () => {
    let uaSpy;
    const baseMockUserData = () => ({
        userId: "123abc",
        computer: {
            "browser.name": "Firefox",
            "screen.size": "0x0",
            "os.name": "Mac OS",
            ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:94.0) Gecko/20100101 Firefox/94.0",
            platform: ""
        }
    });
    let mockUserData = baseMockUserData();

    const mockGetSelf = jest.fn(() => mockUserData);
    const mockUpdateSelf = jest.fn();

    beforeAll(() => {
        ApiClient.mockImplementation(() => {
            return {
                getSelf: mockGetSelf,
                updateSelf: mockUpdateSelf
            };
        });
    });

    beforeEach(() => {
        uaSpy = jest.spyOn(window.navigator, "userAgent", "get").mockImplementation(() => mockUserData.computer.ua);
    });

    afterEach(() => {
        mockUserData = baseMockUserData();
        uaSpy.mockRestore();
        ApiClient.mockClear();
        mockUpdateSelf.mockRestore();
    });

    function setGetSelfMockResponse(key, value) {
        mockUserData.computer[key] = value;
    }

    function fetchCurrentProfile() {
        const uaInfo = uaParser(window.navigator.userAgent);
        const result = {};
        result[forTesting.uaKey] = uaInfo.ua;
        result[forTesting.browserNameKey] = uaInfo.browser.name;
        result[forTesting.osNameKey] = uaInfo.os.name;
        result[browserCheck.screenSizeKey] = `${screen.width}x${screen.height}`;
        result[forTesting.platformKey] = window.navigator.platform;
        return result;
    }

    async function testProfileMismatch(key) {
        setGetSelfMockResponse(key, 'foo');
        const curProfile = fetchCurrentProfile();
        const mockDataKeys = Object.keys(mockUserData.computer);
        for (const k of mockDataKeys) {
            if (k !== key) expect(curProfile[k]).toBe(mockUserData.computer[k]);
        }
        const callback = jest.fn();
        await browserCheck.run(callback);
        expect(callback).not.toHaveBeenCalled();
    
        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("No");
        expect(buttons[1].innerHTML).toBe("Yes");
        // unfortunately b/c the stimulus text is loaded from a file jest replaces it, so
        // this is about all we can test
    }

    async function canUseRegularComputer(callback, answer) {
        // create a mismatch so that user is alerted they're using the wrong computer
        setGetSelfMockResponse(forTesting.browserNameKey, 'foo');

        await browserCheck.run(callback);
        expect(callback).not.toHaveBeenCalled();

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("No");
        expect(buttons[1].innerHTML).toBe("Yes");

        if (answer === "no") {
            buttons[0].click();
        } else if (answer === "yes") {
            buttons[1].click();
        }
    }

    it("should call the callback if the stored profile matches the current profile", async () => {
        const callback = jest.fn();
        await browserCheck.run(callback, null);
        expect(callback.mock.calls.length).toBe(1);
    });

    it("should alert the user the computer is different if the browser name does not match", async () => {
        await testProfileMismatch(forTesting.browserNameKey);
    });

    it("should alert the user the computer is different if the os name does not match", async () => {
        await testProfileMismatch(forTesting.osNameKey);
    });

    it("should alert the user the computer is different if the screen size does not match", async () => {
        await testProfileMismatch(browserCheck.screenSizeKey);
    });

    it("should alert the user the computer is different if the platform does not match", async () => {
        await testProfileMismatch(forTesting.platformKey);
    });

    it("should not alert the user the computer is different if the user agent does not match", async () => {
        setGetSelfMockResponse(forTesting.uaKey, 'foo');
        uaSpy.mockImplementation(() => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:94.0) Gecko/20100101 Firefox/94.0");
        const callback = jest.fn();
        await browserCheck.run(callback, null);
        expect(callback).toHaveBeenCalled();
    });

    it("should ask the user if they can use their regular computer", async () => {
        const callback = jest.fn();
        await canUseRegularComputer(callback);
    });

    it("should not call the callback if the user says they can use their regular computer", async () => {
        const callback = jest.fn();
        await canUseRegularComputer(callback, "yes");

        const stimulus = jsPsych.getDisplayElement().querySelectorAll("#jspsych-html-button-response-stimulus");
        expect(stimulus[0].innerHTML).toMatch(/using the computer, browser, keyboard and monitor you plan to use/);
        expect(callback).not.toHaveBeenCalled();
    });

    it("should ask the user if the change is permanent if they say they can't use their regular computer", async () => {
        const callback = jest.fn();
        await canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");
        expect(callback).not.toHaveBeenCalled();
    });

    it("should store the new profile if the user says the change is permanent", async () => {
        const callback = jest.fn();
        await canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");
        
        buttons[0].click();
        expect(mockUpdateSelf).toHaveBeenCalled();

        const stored = mockUpdateSelf.mock.calls[0][0].computer;
        const keys = Object.keys(stored);
        for (let i=0; i<keys.length; i++) {
            const k = keys[i];
            if (k === forTesting.browserNameKey) continue; // canUseRegularComputer sets this to 'foo' to force a mismatch
            expect(stored[k]).toEqual(mockUserData.computer[k]);
        }
    });

    it("should not store the new profile if the user says the change is not permanent", async () => {
        const callback = jest.fn();
        await canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");        
        buttons[1].click();
        expect(mockUpdateSelf).not.toHaveBeenCalled();
    });

    it("should call the callback when the user is ready to continue if the change is permanent", async () => {
        const callback = jest.fn();
        await canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");
        buttons[0].click();
        clickContinue();
        expect(callback).toHaveBeenCalled();
    });

    it("should also call the callback when the user is ready to continue if the change is *not* permanent", async () => {
        const callback = jest.fn();
        await canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");
        buttons[1].click();
        clickContinue();
        expect(callback).toHaveBeenCalled();
    });

    it("should reject any device type other than undefined", async () => {
        uaSpy.mockImplementation(() => "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1");
        await browserCheck.run();
        const stimulus = jsPsych.getDisplayElement().querySelectorAll("#jspsych-html-button-response-stimulus");
        expect(stimulus[0].innerHTML).toMatch(/cannot be done on tablets/);
    });
});

describe("browser check for returning user whose profile cannot be fetched from db", () => {
    const mockGetSelf = jest.fn(() => null);
    const mockUpdateSelf = jest.fn();
    let origInitKey;

    beforeAll(() => {
        origInitKey = window.localStorage.getItem(`${browserCheck.appName}.${browserCheck.initKey}`);
        window.localStorage.setItem(`${browserCheck.appName}.${browserCheck.initKey}`, true);
        ApiClient.mockImplementation(() => {
            return {
                getSelf: mockGetSelf,
                updateSelf: mockUpdateSelf
            };
        });
    });

    afterAll(() => {
        window.localStorage.setItem(`${browserCheck.appName}.${browserCheck.initKey}`, origInitKey);
    });

    it("should behave as though the profile were fetched and matches the current profile", async () => {
        const callback = jest.fn();
        await browserCheck.run(callback, null);
        expect(callback).toHaveBeenCalled();
    });
});
