'use strict';

import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import introduction_html from "./frag/introduction.html";
import "./style.css"
const uaParser = require("ua-parser-js");
const awsSettings = require("../../../common/aws-settings.json");

function run(idToken, callback) {
    const userInfo = fetchUser(idToken);
    // check for saved browser/monitor details
    const firstTimeUser = !userInfo.raw_ua || !userInfo.parsed_ua || !userInfo.screen_size;
    if (firstTimeUser) {
        gatherComputerProfile(idToken, callback);
    } else {
        checkComputerProfile(userInfo, callback);
    }
    // if found and different, ask them to swtich to their original browser
    // give them the option to say they can't
    // call callback to kick off the experiments
}

const introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["No", "Yes"],
};

function completion(idToken) {
    return {
        type: "html-button-response",
        stimulus: "Great - we're all set! Click the continue button when you're ready to start the experiments.",
        on_start: () => saveComputerProfile(idToken),
        choices: ["Continue"]
    }
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
function gatherComputerProfile(idToken, callback) {
    const timeline = [introduction, switchNode, completion(idToken)];
    jsPsych.init({
        timeline: timeline,
        on_finish: callback
    });
}

function checkComputerProfile(userInfo) {
    // checks to see that current hw & sw details match the ones the user registered
}

function saveComputerProfile(idToken) {
    const uaInfo = uaParser(window.navigator.userAgent);
    console.log('These data will be saved:')
    console.log(`parser results: ${JSON.stringify(uaInfo)}`);
    console.log(`screen dimensions (w X h): ${screen.width} X ${screen.height}`);
    console.log(`platform: ${window.navigator.platform}`);
}

async function fetchUser(idToken) {
    try {
        const response = await fetch(awsSettings.UserApiUrl,
        {
            method: 'GET',
            headers: {
                Authorization: idToken
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch user data: Got response ${response.status}`);
        }
        return response.json();
    } catch (err) {
        console.error(err); // TODO remote logging
    }
}

const browserCheck = {
    run: run
}
export {browserCheck}