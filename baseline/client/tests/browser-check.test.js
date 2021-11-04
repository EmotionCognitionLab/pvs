require("@adp-psych/jspsych/jspsych.js");
import { browserCheck } from "../browser-check/browser-check";
import { clickContinue } from "./utils";
const uaParser = require("ua-parser-js");

function localValForKey(key) {
    return window.localStorage.getItem(`${browserCheck.appName}.${key}`);
}

describe("browser check if window.localStorage.heartBeam.ua is not set", () => {
    let buttons;
    let uaSpy;
    let callback;

    beforeEach(() => {
        window.localStorage.clear();
        callback = jest.fn();
        browserCheck.run(callback);
        buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        uaSpy = jest.spyOn(window.navigator, "userAgent", "get").mockImplementation(() => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36");
    });

    afterEach(() => {
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
        expect(localValForKey(browserCheck.uaKey)).toBe(window.navigator.userAgent);
        expect(localValForKey(browserCheck.platformKey)).toBe(window.navigator.platform);
        const uaInfo = uaParser(window.navigator.userAgent);
        expect(localValForKey(browserCheck.browserNameKey)).toBe(uaInfo.browser.name);
        expect(localValForKey(browserCheck.osNameKey)).toBe(uaInfo.os.name);
        expect(localValForKey(browserCheck.screenSizeKey)).toBe(`${screen.width}x${screen.height}`);
    });

    it("should not save the computer profile if the user says this is not their permanent computer", () => {
        buttons[0].click();
        expect(localValForKey(browserCheck.uaKey)).toBeNull();
        expect(localValForKey(browserCheck.platformKey)).toBeNull();
        expect(localValForKey(browserCheck.browserNameKey)).toBeNull();
        expect(localValForKey(browserCheck.osNameKey)).toBeNull();
        expect(localValForKey(browserCheck.screenSizeKey)).toBeNull();
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
});

function setLStorMockResponse(spy, respMap) {
    spy.mockImplementation((key) => respMap[key]);
}

describe("browser check if window.localStorage.heartBeam.ua is set", () => {
    let lStorGetSpy;
    let lStorSetSpy;
    let uaSpy;
    let mockRespMap;

    beforeEach(() => {
        lStorGetSpy = jest.spyOn(global.Storage.prototype, "getItem");
        lStorSetSpy = jest.spyOn(global.Storage.prototype, "setItem");
        uaSpy = jest.spyOn(window.navigator, "userAgent", "get").mockImplementation(() => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36");
        
        const uaInfo = uaParser(window.navigator.userAgent);
        mockRespMap = {
            [`${browserCheck.appName}.${browserCheck.uaKey}`]: window.navigator.userAgent,
            [`${browserCheck.appName}.${browserCheck.platformKey}`]: window.navigator.platform,
            [`${browserCheck.appName}.${browserCheck.screenSizeKey}`]: `${screen.width}x${screen.height}`,
            [`${browserCheck.appName}.${browserCheck.browserNameKey}`]: uaInfo.browser.name,
            [`${browserCheck.appName}.${browserCheck.osNameKey}`]: uaInfo.os.name
        };
        setLStorMockResponse(lStorGetSpy, mockRespMap);
    });

    afterEach(() => {
        uaSpy.mockRestore();
        lStorGetSpy.mockRestore();
        lStorSetSpy.mockRestore();
    });

    function testProfileMismatch(key) {
        mockRespMap[`${browserCheck.appName}.${key}`] = 'foo';
        setLStorMockResponse(lStorGetSpy, mockRespMap);
        const callback = jest.fn();
        browserCheck.run(callback);
        expect(callback).not.toHaveBeenCalled();
    
        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("No");
        expect(buttons[1].innerHTML).toBe("Yes");
        // unfortunately b/c the stimulus text is loaded from a file jest replaces it, so
        // this is about all we can test
    }

    function canUseRegularComputer(callback, answer) {
        // create a mismatch so that user is alerted they're using the wrong computer
        mockRespMap[`${browserCheck.appName}.${browserCheck.browserNameKey}`] = 'foo';
        setLStorMockResponse(lStorGetSpy, mockRespMap);

        browserCheck.run(callback);
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

    it("should call the callback if the stored profile matches the current profile", () => {
        const callback = jest.fn();
        browserCheck.run(callback);
        expect(callback.mock.calls.length).toBe(1);
    });

    it("should alert the user the computer is different if the browser name does not match", () => {
        testProfileMismatch(browserCheck.browserNameKey);
    });

    it("should alert the user the computer is different if the os name does not match", () => {
        testProfileMismatch(browserCheck.osNameKey);
    });

    it("should alert the user the computer is different if the screen size does not match", () => {
        testProfileMismatch(browserCheck.screenSizeKey);
    });

    it("should alert the user the computer is different if the platform does not match", () => {
        testProfileMismatch(browserCheck.platformKey);
    });

    it("should not alert the user the computer is different if the user agent does not match", () => {
        mockRespMap[`${browserCheck.appName}.${browserCheck.uaKey}`] = 'foo';
        setLStorMockResponse(lStorGetSpy, mockRespMap);
        const callback = jest.fn();
        browserCheck.run(callback);
        expect(callback).toHaveBeenCalled();
    });

    it("should ask the user if they can use their regular computer", () => {
        const callback = jest.fn();
        canUseRegularComputer(callback);
    });

    it("should not call the callback if the user says they can use their regular computer", () => {
        const callback = jest.fn();
        canUseRegularComputer(callback, "yes");

        const stimulus = jsPsych.getDisplayElement().querySelectorAll("#jspsych-html-button-response-stimulus");
        expect(stimulus[0].innerHTML).toMatch(/using the computer, browser, keyboard and monitor you plan to use/);
        expect(callback).not.toHaveBeenCalled();
    });

    it("should ask the user if the change is permanent if they say they can't use their regular computer", () => {
        const callback = jest.fn();
        canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");
        expect(callback).not.toHaveBeenCalled();
    });

    it("should store the new profile if the user says the change is permanent", () => {
        const callback = jest.fn();
        canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");

        expect(window.localStorage.getItem([`${browserCheck.appName}.${browserCheck.browserNameKey}`])).toBe("foo"); // set in canUseRegularComputer
        
        buttons[0].click();
        expect(lStorSetSpy).toHaveBeenCalled();

        const uaInfo = uaParser(window.navigator.userAgent);
        mockRespMap[`${browserCheck.appName}.${browserCheck.browserNameKey}`] = uaInfo.browser.name;
        for (const call of lStorSetSpy.mock.calls) {
            expect(call[1]).toBe(mockRespMap[call[0]]);
        }

    });

    it("should not store the new profile if the user says the change is not permanent", () => {
        const callback = jest.fn();
        canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");

        expect(window.localStorage.getItem([`${browserCheck.appName}.${browserCheck.browserNameKey}`])).toBe("foo"); // set in canUseRegularComputer
        
        buttons[1].click();
        expect(lStorSetSpy).not.toHaveBeenCalled();
    });

    it("should call the callback when the user is ready to continue if the change is permanent", () => {
        const callback = jest.fn();
        canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");
        buttons[0].click();
        clickContinue();
        expect(callback).toHaveBeenCalled();
    });

    it("should also call the callback when the user is ready to continue if the change is *not* permanent", () => {
        const callback = jest.fn();
        canUseRegularComputer(callback, "no");

        const buttons = jsPsych.getDisplayElement().querySelectorAll("button");
        expect(buttons.length).toBe(2);
        expect(buttons[0].innerHTML).toBe("It's permanent");
        expect(buttons[1].innerHTML).toBe("I can use the original later");
        buttons[1].click();
        clickContinue();
        expect(callback).toHaveBeenCalled();
    });

    it("should reject any device type other than undefined", () => {
        uaSpy.mockImplementation(() => "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1");
        browserCheck.run();
        const stimulus = jsPsych.getDisplayElement().querySelectorAll("#jspsych-html-button-response-stimulus");
        expect(stimulus[0].innerHTML).toMatch(/cannot be done on tablets/);
    });
});