'use strict';

import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-fullscreen.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "css/common.css";

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.extend(timezone);

import { DailyStressors } from "../daily-stressors/daily-stressors.js";
import { Demographics } from "../demographics/demographics.js";
import { EmotionalMemory } from "../emotional-memory/emotional-memory.js";
import { Ffmq } from "../ffmq/ffmq.js";
import { Flanker } from "../flanker/flanker.js";
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { MoodPrediction } from "../mood-prediction/mood-prediction.js";
import { NBack } from "../n-back/n-back.js";
import { Panas } from "../panas/panas.js";
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";
import { getAuth } from "auth/auth.js";
import { Logger } from "logger/logger.js";
import Db from "db/db.js";
import { browserCheck } from "../browser-check/browser-check.js";
import { TaskSwitching } from "../task-switching/task-switching.js";
import { FaceName } from "../face-name/face-name.js";
import { PatternSeparation } from "../pattern-separation/pattern-separation.js";
import { MindEyes } from "../mind-eyes/mind-eyes.js";
import { Dass } from "../dass/dass.js";
import { PhysicalActivity } from "../physical-activity/physical-activity.js";
import { SleepSurvey } from "../sleep-survey/sleep-survey.js";
import { SpatialOrientation } from "../spatial-orientation/spatial-orientation.js";
import { Video } from "../video/video.js";
import version from "../version.json";
import ApiClient from "../../../common/api/client.js";

/**
 * Module for determining which baselne tasks a user should be doing at the moment and presenting them
 * to the user in the correct order.
 */
const set1 = ["video", "mood-prediction", "panas", "daily-stressors", "dass", "mind-in-eyes", "verbal-fluency", "flanker", "face-name", "spatial-orientation"];
const set2 = ["physical-activity", "pattern-separation-learning", "demographics",  "verbal-fluency", "n-back", "face-name", "spatial-orientation", "mind-in-eyes", "pattern-separation-recall"];
const set3 = ["panas", "daily-stressors", "task-switching", "mind-in-eyes", "verbal-fluency", "face-name", "n-back", "spatial-orientation", "flanker"];
const set4 = ["ffmq", "pattern-separation-learning", "spatial-orientation", "verbal-fluency", "n-back", "mind-in-eyes", "face-name", "sleep-survey", "pattern-separation-recall", "emotional-memory"];
const set5 = ["verbal-learning-learning", "face-name", "n-back", "mind-in-eyes", "flanker", "panas", "daily-stressors", "verbal-learning-recall"];
const set6 = ["mood-memory", "emotional-memory", "pattern-separation-learning", "n-back", "verbal-fluency", "spatial-orientation", "mind-in-eyes", "face-name", "pattern-separation-recall", "video"];
const set7 = ["mood-prediction", "panas", "daily-stressors", "dass", "mind-in-eyes", "verbal-fluency", "flanker", "face-name", "spatial-orientation"];
const set8 = ["pattern-separation-learning",  "verbal-fluency", "n-back", "face-name", "spatial-orientation", "mind-in-eyes", "pattern-separation-recall"];
const set9 = ["panas", "daily-stressors", "task-switching", "mind-in-eyes", "verbal-fluency", "face-name", "n-back", "spatial-orientation", "flanker"];
const set10 = ["ffmq", "pattern-separation-learning", "spatial-orientation", "verbal-fluency", "n-back", "mind-in-eyes", "face-name", "sleep-survey", "pattern-separation-recall", "emotional-memory"];
const set11 = ["verbal-learning-learning", "face-name", "n-back", "mind-in-eyes", "flanker", "panas", "daily-stressors", "verbal-learning-recall"];
const set12 = ["mood-memory", "emotional-memory", "pattern-separation-learning", "n-back", "verbal-fluency", "spatial-orientation", "mind-in-eyes", "face-name", "pattern-separation-recall"];

const preInterventionSetCount = 6;
const allSets = [set1, set2, set3, set4, set5, set6, set7, set8, set9, set10, set11, set12];
const setFinished = "set-finished";
const setStarted = "set-started";
const doneForToday = "done-for-today";
const allDone = "all-done";
const startNewSetQuery = "start-new-set-query";
let logger;
let db;
let homeComplete = false;

/**
 * 
 * @param {Object[]} allResults All results for the current user as returned by db.getAllResultsForCurrentUser. These must be sorted by date from earliest to latest.
 * @param {Function} saveResultsCallback Callback function used to save results of each task. Should accept experimentName (string) and results (array) parameters.
 * @returns {Object} Object with fields 'set' (current set number) and 'remainingTasks' (array of remaining tasks in current set)
 */
// TODO no need to return set
function getSetAndTasks(allResults, saveResultsCallback) {
    const queryParams = new URLSearchParams(window.location.search.substring(1));
    const tasks = queryParams.get("tasks");
    if (tasks !== null) {
        const requestedTasks = tasks.split(",");
        const setNum = parseInt(queryParams.get("setNum")) || 1;
        const timeline = tasksForSet(requestedTasks, setNum, allResults, saveResultsCallback, false);
        return { set: 1, remainingTasks: timeline };
    }

    const highestFinishedSet = findHighestSet(allResults, setFinished);
    const highestStartedSet = findHighestSet(allResults, setStarted);

    if (highestStartedSet === null && highestFinishedSet === null) {
        const timeline = tasksForSet(set1, 1, allResults, saveResultsCallback, false);
        return { set: 1, remainingTasks: timeline };
    } else if ( highestFinishedSet && 
        (highestStartedSet === null || 
        highestStartedSet.results.setNum === highestFinishedSet.results.setNum ||
        highestStartedSet.results.setNum < highestFinishedSet.results.setNum) ) {
        // treat them as between sets
       if (canDoAdditionalSet(highestStartedSet, highestFinishedSet)) {
           const nextSet = highestFinishedSet.results.setNum + 1;
           const timeline = tasksForSet(allSets[nextSet - 1], nextSet, allResults, saveResultsCallback, false);
           return { set: nextSet, remainingTasks: timeline };
       } else {
           // done for today (or for good)
           return allDoneTimeline(highestFinishedSet.results.setNum);
       }
    } else {
        // treat them as in the middle of a set
        const tasksToDo = findRemainingTasksForSet(highestStartedSet, allResults);
        if (tasksToDo.length === 0) {
            // somehow the set finished record didn't get written
            // write it and figure out if they can do another set
            console.warn(`User has done all tasks for set ${highestStartedSet.results.setNum}, but no set-finished record was saved. Creating one now.`);
            const newSetFinishedRec = {
                experiment: setFinished,
                dateTime: new Date().toISOString(),
                results: {"setNum": highestStartedSet.results.setNum }
            };
            saveResultsCallback(newSetFinishedRec.experiment, newSetFinishedRec.results);
            
            if (canDoAdditionalSet(highestStartedSet, newSetFinishedRec)) {
                const nextSet = newSetFinishedRec.results.setNum + 1;
                const timeline = tasksForSet(allSets[nextSet - 1], nextSet, allResults, saveResultsCallback, false);
                return { set: nextSet, remainingTasks: timeline };
            } else {
                // done for today (or for good)
                return allDoneTimeline(newSetFinishedRec.results.setNum);
            }
        }

        const nextSetOk = canDoAdditionalSet(highestStartedSet, highestFinishedSet);
        const timeline = tasksForSet(tasksToDo, highestStartedSet.results.setNum, allResults, saveResultsCallback, nextSetOk);
        if (nextSetOk) {
            const nextSetNum = highestStartedSet.results.setNum + 1;
            timeline.push({timeline: startNewSetQueryTask, taskName: startNewSetQuery}); // give them the choice to start the next set
            Array.prototype.push.apply(timeline, tasksForSet(allSets[nextSetNum - 1], nextSetNum, allResults, saveResultsCallback, false));
        }
        return { set: highestStartedSet.results.setNum, remainingTasks: timeline };
    }
}

function allDoneTimeline(highestFinishedSetNum) {
    if ((highestFinishedSetNum === preInterventionSetCount && !homeComplete) || highestFinishedSetNum === allSets.length) {
        return { set: highestFinishedSetNum, remainingTasks: [{timeline: [allDoneMessage], taskName: allDone}] };
    } else {
        return { set: highestFinishedSetNum, remainingTasks: [{timeline: [doneForTodayMessage], taskName: doneForToday}] };
    }
}

/**
 * Returns the result record for the highest set number the user has started or finished.
 * Returns null if the user has not started/finished any sets.
 * @param {Object[]} allResults List of all experimental results for the user, sorted from least to most recent
 * @param {string} startedOrFinished either 'set-started' or 'set-finished'
 */
function findHighestSet(allResults, startedOrFinished) {
    if (startedOrFinished !== setStarted && startedOrFinished !== setFinished) {
        throw new Error(`Expected ${setStarted} or ${setFinished} for startedOrFinished param, but got ${startedOrFinished}.`);
    }
    const sets = allResults.filter(r => r.experiment === startedOrFinished);
    let lastSet;
    let lastSetNum = 0;
    sets.forEach(s => {
        if (s.results.setNum > lastSetNum) {
            lastSet = s;
            lastSetNum  = s.results.setNum;
        }
    });
    if (lastSetNum === 0) return null;
    return lastSet;
}

/**
 * Returns a list of the names of the tasks from the set that the user has not already done.
 * The user is considered to have done the task if they have at least one
 * relevant result from it. Returns an empty list if the user has done all of the tasks
 * from that set.
 * @param {Object} set The set-started record 
 * @param {Object[]} allResults 
 */
function findRemainingTasksForSet(set, allResults) {
    let setStartedIdx = null;
    for (const [idx, r] of allResults.entries()) {
        if (r.experiment === set.experiment && 
            r.results.setNum === set.results.setNum &&
            r.dateTime === set.dateTime
            ) {
                setStartedIdx = idx;
            }
    }

    if (setStartedIdx === null) {
        throw new Error(`Could not find set ${JSON.stringify(set)} in allResults while trying to identify remaining tasks.`);
    }

    const doneResults = allResults.slice(setStartedIdx).filter(r => r.isRelevant).map(r => r.experiment);
    const doneTasks = dedupeExperimentResults(doneResults);
    if (doneTasks.length === 0) return allSets[set.results.setNum - 1];

    const setTasks = allSets[set.results.setNum - 1];
    for (let i = 0; i < setTasks.length; i++) {
        const doneTask = doneTasks.shift();
        if (!doneTask || doneTask !== setTasks[i]) {
            return setTasks.slice(i);
        }
    }
    return [];
}

/**
 * Builds jsPsych nodes for the given remaining task names. 
 * @param {string[]} remainingTaskNames List of experimental tasks to be completed
 * @param {number} setNum The number of the current set of tasks the participant is doing
 * @param {Object[]} allResults Results of all previous experiments the participant has done
 * @param {Function} saveResultsCallback Callback function to save results of each experiment.
 * @returns {Object[]}
 */
function tasksForSet(remainingTaskNames, setNum, allResults, saveResultsCallback, nextSetOk) {
    const allTimelines = [];
    const atSetStart = remainingTaskNames.length === allSets[setNum - 1].length &&
        remainingTaskNames.every((item, idx) => item === allSets[setNum - 1][idx]);

    for  (let i = 0; i < remainingTaskNames.length; i++) {
        const task = taskForName(remainingTaskNames[i], {setNum: setNum, allResults: allResults});
        const taskTimeline = task.getTimeline();
        taskTimeline.unshift(fullScreenNode);
        const node = {
            timeline: taskTimeline,
            taskName: task.taskName,
            setNum: setNum
        };
        if (i === 0 && atSetStart) {
            node.on_timeline_start = () => {
                saveResultsCallback(setStarted, [{"setNum": setNum }]);
                saveResultsCallback(task.taskName, [{"taskStarted": true, "setNum": setNum}]);
            };
        } else {
            node.on_timeline_start = () => {
                saveResultsCallback(task.taskName, [{"taskStarted": true, "setNum": setNum}]);
            };
        }
        allTimelines.push(node);
    }
    if (setNum === allSets.length) {
        allTimelines.push({timeline: [allDoneMessage], taskName: allDone});
    } else if (!nextSetOk || atSetStart) {
        allTimelines.push({timeline: [doneForTodayMessage], taskName: doneForToday});
    }
    return allTimelines;
}

/**
 * Given a list of experimental names in which each name may appear multiple times in a row,
 * reduces it to a list of experiment names where no name appears more than once in a row. (Unless
 * "set-finished", a special experiment name that marks the end of a set of experiments, originally
 * appeared in between two occurences of the same experiment name.)
 * @param {string[]} completedExperiments Array of completed experiment names
 * @returns {string[]} Array of experiment names where no name appears more than once in a row.
 */
function dedupeExperimentResults(completedExperiments) {
    let curExp = "";
    const result = [];
    for (const e of completedExperiments) {
        if (e !== curExp) {
            curExp = e;
            if (curExp !== setFinished && curExp != setStarted) {
                result.push(curExp);
            }
        }
    }
    return result;
}

function taskForName(name, options) {
    switch(name) {
        case "daily-stressors":
            return new DailyStressors();
        case "dass":
            return new Dass();
        case "demographics":
            return new Demographics();
        case "emotional-memory":
            return new EmotionalMemory(options.setNum || 1);
        case "face-name":
            return new FaceName(options.setNum || 1);
        case "ffmq":
            return new Ffmq();
        case "flanker":
            return new Flanker(options.setNum || 1);
        case "mind-in-eyes":
            return new MindEyes(options.setNum || 1);
        case "mood-memory":
            return new MoodMemory();
        case "mood-prediction":
            return new MoodPrediction();
        case "n-back":
            return new NBack(options.setNum || 1);
        case "panas":
            return new Panas();
        case "pattern-separation-learning":
            return new PatternSeparation(options.setNum || 1, false);
        case "pattern-separation-recall":
            return new PatternSeparation(options.setNum || 1, true);
        case "physical-activity":
            return new PhysicalActivity();
        case "sleep-survey":
            return new SleepSurvey();
        case "spatial-orientation":
            return new SpatialOrientation(options.setNum || 1);
        case "task-switching":
            return new TaskSwitching();
        case "verbal-fluency": {
            const allResults = options.allResults.map(r => r.results);
            const availableLetters = new Set(VerbalFluency.possibleLetters);
            // iterate over allResults, find out which letters have been used,
            // pick letter 
            allResults.forEach(r => {
                if (r.letter) {
                    availableLetters.delete(r.letter);
                }
            });
            const availableLettersArr = Array.from(availableLetters);
            if (availableLettersArr.length === 0) {
                throw new Error("All of the verbal fluency tasks have been completed.");
            }
            const rand = Math.floor(Math.random() * availableLettersArr.length);
            const letter = availableLettersArr[rand];
            return new VerbalFluency(letter);
        }
        case "verbal-learning-learning":
            return new VerbalLearning(options.setNum || 1, 1);
        case "verbal-learning-recall":
            return new VerbalLearning(options.setNum || 1, 2, verbalLearningEndTime.bind(this));
        case "video":
            return new Video(options.setNum);
        default:
           // throw new Error(`Unknown task type: ${name}`);
           return {getTimeline: () => taskNotAvailable(name), taskName: name}; // TODO remove this and throw error instead once we have code for all tasks
    }
}

async function verbalLearningEndTime() {
    const vlResults = await db.getExperimentResultsForCurrentUser('verbal-learning-learning');
    if (vlResults.length === 0) {
        return 0;
    }
    const last = vlResults[vlResults.length - 1];
    const parsedDate = Date.parse(last.dateTime);
    return parsedDate;
}


/**
 * Users may only do an additional set (that is, do 
 * another set if they already finished one today or 
 * are in the middle of one they started today) if:
 * (a) They are in between sets and
 *    (1) They completed the last set >= 1 hour ago or
 *    (2) The last set took them >3 hours to complete
 * or
 * (b) They are in the middle of a set that they started >3 hours ago
 * See https://github.com/EmotionCognitionLab/pvs/issues/68
 * @param {Object[]} allResults All results for the user, as returned by ../common/db/db.js:getAllResultsForCurrentUser()
 * @returns true if the user can start the next set, false otherwise
 */
function canDoAdditionalSet(highestStartedSet, highestFinishedSet) {
    if (highestStartedSet === null && highestFinishedSet === null) return false;

    if (highestFinishedSet && highestFinishedSet.results.setNum === allSets.length) return false;

    if (highestFinishedSet && highestFinishedSet.results.setNum === preInterventionSetCount && !homeComplete) return false;

    if (highestFinishedSet && ( highestStartedSet === null ||
        highestStartedSet.results.setNum < highestFinishedSet.results.setNum || 
        highestStartedSet.results.setNum === highestFinishedSet.results.setNum )) {
        // they're in between sets
        // (the started is null and the started < finished
        // conditions shouldn't happen, but if they do
        // we treat them as between sets)
        const lastFinishedTime = new Date(highestFinishedSet.dateTime);
        const oneHourAgo = new Date(Date.now() - (1000 * 60 * 60));
        if (highestStartedSet === null) return oneHourAgo > lastFinishedTime;

        const lastStartedTime = new Date(highestStartedSet.dateTime);
        const lastSetDuration =  lastFinishedTime - lastStartedTime; 
        return oneHourAgo > lastFinishedTime || lastSetDuration > (3 * 60 * 60 * 1000);
    } else {
        // they're in the middle of a set
        // (or we failed to save the set finished record for their latest set,
        // but in that case we treat them as being in the middle of a set)
        const threeHoursAgo = new Date(Date.now() - (3 * 60 * 60 * 1000));
        const lastStartedTime = new Date(highestStartedSet.dateTime);
        return threeHoursAgo > lastStartedTime;
    }
}

function init() {
    try {
        logger = new Logger();
        const lStor = window.localStorage;
        const scopes = [];
        if (!lStor.getItem(`${browserCheck.appName}.${browserCheck.initKey}`)) {
            // we may have a new user who needs phone # verification
            scopes.push('openid');
            scopes.push('aws.cognito.signin.user.admin');
        }
        const cognitoAuth = getAuth(doAll, handleError, null, scopes);
        cognitoAuth.getSession();
    } catch (err) {
        console.error('Error in dailyTasks.init', err);
    }
    
}

async function doAll(session) {
    try {
        const client = new ApiClient(session);
        const user = await client.getSelf();
        if (user.startDate) {
            const start = dayjs(user.startDate).tz('America/Los_Angeles', true);
            const now = dayjs().tz('America/Los_Angeles');
            if (start.isAfter(now)) {
                // show 'come back later' message
                jsPsych.init({
                    timeline: [returnOnStartDateMessage(start.format('MM/DD/YYYY'))]
                });
                return;
            }
        }
        homeComplete = user.homeComplete || false;
        db = new Db({session: session});
        // pre-fetch all results before doing browser check to avoid
        // lag after browser check sends them to start experiments
        const allResults = await db.getAllResultsForCurrentUser();
        await browserCheck.run(startTasks.bind(null, allResults, saveResultsCallback), session);
    } catch (err) {
        logger.error('Error in dailyTasks.doAll', err);
    }
}

function startTasks(allResults, saveResultsCallback) {
    const setAndTasks = getSetAndTasks(allResults, saveResultsCallback);
    if (setAndTasks.remainingTasks.length === 1 &&
        (setAndTasks.remainingTasks[0].taskName === allDone || setAndTasks.remainingTasks[0].taskName === doneForToday)) {
        runTask(setAndTasks.remainingTasks, 0, saveResultsCallback);
    } else {
        const progressNode = setAndTasks.set === 1 ? set1ProgressMessage : generalProgressMessage(setAndTasks.set);
        progressNode.on_finish = () => {
            runTask(setAndTasks.remainingTasks, 0, saveResultsCallback);
        };
        jsPsych.init({
            timeline: [progressNode]
        });
    }
}

function runTask(tasks, taskIdx, saveResultsCallback=saveResultsCallback) {
    if (taskIdx >= tasks.length) {
        logger.error(`Was asked to run task ${taskIdx}, but tasks array max index is ${tasks.length - 1}`);
        jsPsych.init({
            timeline: [errorHappenedMessage]
        });
        return;
    }
    tasks[taskIdx].on_timeline_finish = () => {
        const computerDetails = browserCheck.fetchCurrentProfile();
        saveResultsCallback(tasks[taskIdx].taskName, [{ua: window.navigator.userAgent, screen: computerDetails[browserCheck.screenSizeKey], v: version.v}]);
        
        // -2 b/c the "all done" screen is its own timeline that will never finish b/c there's nothing to do on that screen
        // check for startNewSetQuery b/c that means that we've been passed a set of tasks that
        // spans multiple sets
        if (taskIdx === tasks.length - 2 || tasks[taskIdx + 1].taskName === startNewSetQuery) {
            saveResultsCallback(setFinished, [{ "setNum": tasks[taskIdx].setNum }]);
        } 
        if (taskIdx < tasks.length - 1) {
            runTask(tasks, taskIdx + 1, saveResultsCallback);
        }
    };
    jsPsych.init({
        timeline: [tasks[taskIdx]],
        on_data_update: (data) => {
            saveResultsCallback(tasks[taskIdx].taskName, [data]);
        }
    });
}

function saveResultsCallback(experimentName, results) {
    try {
        db.saveResults(experimentName, results);
    } catch (err) {
        handleSaveError(err, experimentName, results);
    }
}

function handleSaveError(err, experimentName, results) {
    const cognitoAuth = getAuth();
    logger.error(`Error saving data for ${cognitoAuth.getUsername()}: ${JSON.stringify({experiment: experimentName, results: results})}`);
    logger.error(err);
}

function handleError(err) {
    logger.error(err);
    // something went wrong; redirect users to cognito sign-in page
    const cognitoAuth = getAuth(() => {}, () => {});
    const loginUrl = cognitoAuth.getFQDNSignIn();
    window.location = loginUrl;
}

function taskNotAvailable(taskName) {
    return [{
        type: "html-button-response",
        stimulus: `The code for ${taskName} has not been written yet. Please continue to the next task.`,
        choices: ["Continue"]
    }];
}

const fullScreenTrial = {
    type: "fullscreen",
    fullscreen_mode: true,
    message: "<p>These experiments must be run in full screen mode. Please click the button below to set your browser to full screen mode.</p>",
    button_label: "Go full screen",
    delay_after: 0
};

const fullScreenNode = {
    timeline: [fullScreenTrial],
    conditional_function: function() {
        return !(document.fullscreenElement || document.webkitFullscreenElement ||
        document.mozFullScreenElement || document.msFullscreenElement);
    }
};

const startNewSetQueryTask = {
    type: "html-button-response",
    stimulus: "You have finished one set of experiments. Would you like to start the next set? It will take about 40 minutes.",
    choices: ["I'll do it later", "Start"],
    on_finish: function(data) {
        if(data.response === 0){
            jsPsych.endExperiment("Thanks! You're all done for today.");
        }
    }
};

const allDoneMessage = {
    type: "html-button-response",
    stimulus: "Congratulations! You have done all of the daily measurements required for this part of the experiment. You may close this window.",
    choices: [],
};

const doneForTodayMessage = {
    type: "html-button-response",
    stimulus: "Congratulations! You have done all of the daily measurements for today. Please come back tomorrow to continue. Press 'esc' to exit full screen mode.",
    choices: [],
};

const errorHappenedMessage = {
    type: "html-button-response",
    stimulus: "Unfortunately, an error has occurred. The team has been alerted and will work to fix it. Please try again in a few hours.",
    choices: []
};

const set1ProgressMessage = {
    type: "html-keyboard-response",
    stimulus: "<p>Welcome! You will be asked to do 6 sets of daily emotion and cognition tasks over 6 different days. You are about to start set 1.</p><em>Please press the space bar to continue</em>",
    choices: [" "]
};

const generalProgressMessage = (setNum) => ({
    type: "html-keyboard-response",
    stimulus: `<p>Welcome back! You have completed ${setNum-1} out of 6 sets of daily tasks. You are on set ${setNum}.</p><em>Please press the space bar to continue</em>`,
    choices: [" "]
});


const returnOnStartDateMessage = (startDateStr) => ({
    type: "html-button-response",
    stimulus: `You are currently scheduled to start the HeartBEAM experiment on ${startDateStr}. Please come back then to begin your assessment.`,
    choices: []
});

if (window.location.href.includes("daily-tasks")) {
    init();
}

// ugh. need this so that tests can set homeComplete.
function setHomeComplete(someVal) {
    homeComplete = someVal;
}

export { setHomeComplete, preInterventionSetCount, getSetAndTasks, allSets, taskForName, doneForToday, allDone, runTask, setFinished, setStarted, startNewSetQuery, startTasks };



