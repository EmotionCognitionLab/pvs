'use strict';

import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-call-function.js";
import Db from "db/db.js";
import introduction_html from "./frag/introduction.html";
import different_html from "./frag/different.html";
import permanent_change_html from "./frag/permanent-change.html";
import "./style.css";
const uaParser = require("ua-parser-js");

const initKey = 'initialized';
const uaKey = 'ua';
const browserNameKey = 'browser.name';
const osNameKey = 'os.name';
const screenSizeKey = 'screen.size';
const platformKey = 'platform';
const appName = 'heartBeam';
let db;


async function run(callback, session) {
    db = new Db({session: session});
    const uaInfo = uaParser(window.navigator.userAgent);
    if (uaInfo.device.type) { // uaParser only defines device type for non-computers
        jsPsych.init({
            timeline: [badDevice]
        });
        return;
    }
    // check for saved browser/monitor details
    const firstTimeUser = !window.localStorage.getItem(`${appName}.${initKey}`);
    if (firstTimeUser) {
        gatherComputerProfile(callback);
    } else {
        const profile = await fetchStoredProfile();
        if (!profile || computerProfileMatchesStoredProfile(profile)) { // if for some reason we don't get the profile just assume it matches
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

const saveProfileCall = {
    type: "call-function",
    async: true,
    func: function(done) {
        saveComputerProfile();
        done();
    }
};

const saveNeededNode = {
    timeline: [saveProfileCall],
    conditional_function: function () {
        const data = jsPsych.data.get().last(1).values()[0];
        return data.response === 0; // permanentChange.choices[0]
    }
};

const permanentChange = {
    type: "html-button-response",
    stimulus: permanent_change_html,
    choices: ["It's permanent", "I can use the original later"],
};

// If computer profile has changed, this
// asks if the change is permanent and, if so,
// saves the new profile.
function queryChangePermanent(callback) {
    const timeline = [different, switchNeededNode, permanentChange, saveNeededNode, completion(null)];
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

async function saveComputerProfile() {
    try {
        const curProfile = fetchCurrentProfile();
        await db.updateSelf({"computer": curProfile});
        // save something to local storage for a rough, quick check
        // of whether the user is brand new or not
        const lstor = window.localStorage;
        lstor.setItem(`${appName}.${initKey}`, true);
    } catch (err) {
        console.error(err);
    } 
}

async function fetchStoredProfile() {
    try {
        const user = await db.getSelf();
        if (user && user.computer) return user.computer;
        return null;
    } catch (err) {
        console.error(err);
        return null;
    }
}

const browserCheck = {
    run: run,
    fetchCurrentProfile: fetchCurrentProfile,
    initKey: initKey,
    screenSizeKey: screenSizeKey,
    appName: appName
};
export {browserCheck};
export const forTesting = { uaKey, browserNameKey, osNameKey, platformKey };
