'use strict';

import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import introduction_html from "./frag/introduction.html";
import "./style.css"
const uaParser = require("ua-parser-js");

const uaKey = 'ua';
const browserNameKey = 'browser.name';
const osNameKey = 'os.name';
const screenSizeKey = 'screen.size';
const platformKey = 'platform';
const profileKeys = [uaKey, browserNameKey, osNameKey, screenSizeKey, platformKey];
const appName = 'heartBeam';

function run(callback) {
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
        }
    }
}

const introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["No", "Yes"],
};

const completion = {
    type: "html-button-response",
    stimulus: "Great - we're all set! Click the continue button when you're ready to start the experiments.",
    on_start: saveComputerProfile,
    choices: ["Continue"]
}

const switchSetup = {
    type: "html-button-response",
    stimulus: `OK. Once you're using the computer, browser, keyboard and monitor you plan to use for all of the experiments, please enter this URL in your browser there to continue: ${window.location.href}`,
    choices: []
}

const switchNode = {
    timeline: [switchSetup],
    conditional_function: function () {
        const data = jsPsych.data.get().last(1).values()[0];
        return data.response === 0; // introduction.choices[0]
    }
}

// Welcomes user to experiment, 
// emphasizes need to use consistent hw & sw,
// saves details about hw & sw
function gatherComputerProfile(callback) {
    const timeline = [introduction, switchNode, completion];
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
    run: run
}
export {browserCheck}