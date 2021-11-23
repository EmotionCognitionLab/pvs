'use strict';

import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import introduction_html from "./frag/introduction.html";
import different_html from "./frag/different.html";
import permanent_change_html from "./frag/permanent-change.html";
import "./style.css";
const uaParser = require("ua-parser-js");

const uaKey = 'ua';
const browserNameKey = 'browser.name';
const osNameKey = 'os.name';
const screenSizeKey = 'screen.size';
const platformKey = 'platform';
const profileKeys = [uaKey, browserNameKey, osNameKey, screenSizeKey, platformKey];
const appName = 'heartBeam';

function run(callback) {
    const uaInfo = uaParser(window.navigator.userAgent);
    if (uaInfo.device.type) { // uaParser only defines device type for non-computers
        jsPsych.init({
            timeline: [badDevice]
        });
        return;
    }
    const profile = fetchStoredProfile();
    // check for saved browser/monitor details
    const firstTimeUser = profile[uaKey] === null;
    if (firstTimeUser) {
        gatherComputerProfile(callback);
    } else {
        if (computerProfileMatchesStoredProfile(profile)) {
            callback();
        } else {
            // if found and different, ask them to swtich to their original browser
            // give them the option to say they can't
            // call callback to kick off the experiments
            queryChangePermanent(callback);
        }
    }
}

const badDevice = {
    type: "html-button-response",
    stimulus: "These experiments cannot be done on tablets, mobile devices, game consoles, etc. - only on computers that do not have a virtual keyboard. " +
        `When you are at regular computer, please enter this URL in your browser there to continue: ${window.location.href}`,
    choices: []
};

const introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["No", "Yes"],
};

function completion(onStartFn) {
    return {
        type: "html-button-response",
        stimulus: "Great - we're all set! Click the continue button when you're ready to start the experiments.",
        on_start: onStartFn,
        choices: ["Continue"]
    };
}

const switchSetup = {
    type: "html-button-response",
    stimulus: `OK. Once you're using the computer, browser, keyboard and monitor you plan to use for all of the experiments, please enter this URL in your browser there to continue: ${window.location.href}`,
    choices: []
};

const switchNode = {
    timeline: [switchSetup],
    conditional_function: function () {
        const data = jsPsych.data.get().last(1).values()[0];
        return data.response === 0; // introduction.choices[0]
    }
};

// Welcomes user to experiment, 
// emphasizes need to use consistent hw & sw,
// saves details about hw & sw
function gatherComputerProfile(callback) {
    const timeline = [introduction, switchNode, completion(saveComputerProfile)];
    jsPsych.init({
        timeline: timeline,
        on_finish: callback
    });
}

const different = {
    type: "html-button-response",
    stimulus: different_html,
    choices: ["No", "Yes"]
};

const switchNeededNode = {
    timeline: [switchSetup],
    conditional_function: function () {
        const data = jsPsych.data.get().last(1).values()[0];
        return data.response === 1; // different.choices[1]
    }
};

const permanentChange = {
    type: "html-button-response",
    stimulus: permanent_change_html,
    choices: ["It's permanent", "I can use the original later"],
    on_finish: function(data) {
        if (data.response === 0) {
            // it's a permanent change; save the new profile
            saveComputerProfile();
        }
    }
};

// If computer profile has changed, this
// asks if the change is permanent and, if so,
// saves the new profile.
function queryChangePermanent(callback) {
    const timeline = [different, switchNeededNode, permanentChange, completion(null)];
    jsPsych.init({
        timeline: timeline,
        on_finish: callback
    });
}

function computerProfileMatchesStoredProfile(storedProfile) {
    // checks to see that current hw & sw details match the ones the user registered
    const curProfile = fetchCurrentProfile();
    if (Object.keys(curProfile).length !== Object.keys(storedProfile).length) return false;
    for (const prop in storedProfile) {
        if (prop === uaKey) continue; // the whole UA string is too likely to change
        if (storedProfile[prop] !== curProfile[prop]) return false;
    }
    return true;
}

function fetchCurrentProfile() {
    const uaInfo = uaParser(window.navigator.userAgent);
    const result = {};
    result[uaKey] = uaInfo.ua;
    result[browserNameKey] = uaInfo.browser.name;
    result[osNameKey] = uaInfo.os.name;
    result[screenSizeKey] = `${screen.width}x${screen.height}`;
    result[platformKey] = window.navigator.platform;
    return result;
}

function saveComputerProfile() {
    const curProfile = fetchCurrentProfile();
    const lStor = window.localStorage;
    for (const item in curProfile) {
        lStor.setItem(`${appName}.${item}`, curProfile[item]);
    }
}

function fetchStoredProfile() {
    const result = {};
    const lStor = window.localStorage;
    profileKeys.forEach(k => {
        result[k] = lStor.getItem(`${appName}.${k}`);
    });
    return result;
}

const browserCheck = {
    run: run,
    uaKey: uaKey,
    browserNameKey: browserNameKey,
    osNameKey: osNameKey,
    screenSizeKey: screenSizeKey,
    platformKey: platformKey,
    appName: appName
};
export {browserCheck};
