'use strict';

import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-fullscreen.js";
import "css/common.css";
import { DailyStressors } from "../daily-stressors/daily-stressors.js";
import { Demographics } from "../demographics/demographics.js";
import { Ffmq } from "../ffmq/ffmq.js";
import { Flanker } from "../flanker/flanker.js";
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { MoodPrediction } from "../mood-prediction/mood-prediction.js";
import { Panas } from "../panas/panas.js";
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";
import { getAuth } from "auth/auth.js";
import { Logger } from "../../../common/logger/dist/logger.js";
import { saveResults, getAllResultsForCurrentUser, getExperimentResultsForCurrentUser } from "../../../common/db/dist/db.js";
import { browserCheck } from "../browser-check/browser-check.js";
import { TaskSwitching } from "../task-switching/task-switching.js";
import { FaceName } from "../face-name/face-name.js";
import { PatternSeparation } from "../pattern-separation/pattern-separation.js";
import { MindEyes } from "../mind-eyes/mind-eyes.js";
import { Dass } from "../dass/dass.js";
import { PhysicalActivity } from "../physical-activity/physical-activity.js";
import { SpatialOrientation } from "../spatial-orientation/spatial-orientation.js";

/**
 * Module for determining which baselne tasks a user should be doing at the moment and presenting them
 * to the user in the correct order.
 */

const set1 = ["mood-prediction", "panas", "daily-stressors", "dass", "n-back", "mind-in-eyes", "verbal-fluency", "flanker", "face-name", "spatial-orientation"];
const set2 = ["demographics", "physical-activity", "panas", "daily-stressors", "verbal-fluency", "n-back", "pattern-separation-learning", "flanker", "face-name", "spatial-orientation", "mind-in-eyes", "pattern-separation-recall"];
const set3 = ["panas", "daily-stressors", "task-switching", "mind-in-eyes", "verbal-fluency", "face-name", "n-back", "spatial-orientation", "flanker"];
const set4 = ["panas", "daily-stressors", "ffmq", "pattern-separation-learning", "spatial-orientation", "verbal-fluency", "n-back", "mind-in-eyes",  "flanker", "face-name", "pattern-separation-recall"];
const set5 = ["verbal-learning-learning", "face-name", "n-back", "mind-in-eyes", "flanker", "verbal-learning-recall"];
const set6 = ["mood-memory", "panas", "daily-stressors", "pattern-separation-learning", "n-back", "verbal-fluency", "spatial-orientation", "mind-in-eyes", "flanker", "face-name", "pattern-separation-recall"];
const allSets = [set1, set2, set3, set4, set5, set6];
const setFinished = "set-finished";
const setStarted = "set-started";
const doneForToday = "done-for-today";
const allDone = "all-done";
const startNewSetQuery = "start-new-set-query";
let userSession;
const logger = new Logger();

/**
 * 
 * @param {Object[]} allResults All results for the current user as returned by db.getAllResultsForCurrentUser. These must be sorted by date from earliest to latest.
 * @param {Function} saveResultsCallback Callback function used to save results of each task. Should accept experimentName (string) and results (array) parameters.
 * @returns {Object} Object with fields 'set' (current set number) and 'remainingTasks' (array of remaining tasks in current set)
 */
// TODO no need to return set
function getSetAndTasks(allResults, saveResultsCallback) {
    // we don't consider an experiment "completed" unless it has
    // at least one relevant result
    // https://github.com/EmotionCognitionLab/pvs/issues/84
    const completedTasks = dedupeExperimentResults(
        allResults.filter(r => r.isRelevant).map(r => r.experiment)
    );
    const nextSetOk = canStartNextSet(allResults);
    if (completedTasks.length === 0) {
        const timeline = tasksForSet(set1, 1, allResults, saveResultsCallback, nextSetOk);
        return { set: 1, remainingTasks: timeline }
    }
    for (var i = 0; i < allSets.length; i++) {
        const set = allSets[i];
        for (var j = 0; j < set.length; j++) {
            const task = set[j];
            const completed = completedTasks.shift();
            if (completed) {
                if (completed !== task) {
                    throw new Error(`Expected ${task} but found ${completed}. It looks like tasks have been done out of order.`);
                }
            } else {
                // we've reached the end of the completed tasks; return our results
                let remainingTasks = [];
                const setNum = i + 1; // add 1 b/c setNum starts from 1
                if (j === 0 && !nextSetOk) {
                    // we're at the start of a new set and the participant
                    // doesn't meet the criteria for starting the next one yet
                    return { set: setNum, remainingTasks: [{timeline: [doneForTodayMessage], taskName: doneForToday}] };
                }
                // they didn't finish this set - return the remaining tasks
                remainingTasks = set.slice(j)
                const timeline = tasksForSet(remainingTasks, setNum, allResults, saveResultsCallback, nextSetOk);
                if (j > 0 && nextSetOk && i < allSets.length - 1) {
                    timeline.push({timeline: startNewSetQueryTask, taskName: startNewSetQuery}); // give them the choice to start the next set
                    Array.prototype.push.apply(timeline, tasksForSet(allSets[i+1], setNum + 1, allResults, saveResultsCallback, false));
                }
                return { set: setNum, remainingTasks: timeline }
            }
        }
    }
    // the participant has completed all tasks in all sets - let them know
    return { set: allSets.length, remainingTasks: [{timeline: [allDoneMessage], taskName: allDone}] }
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
        }
        if (i === 0 && atSetStart) {
            node.on_timeline_start = () => {
                saveResultsCallback(setStarted, [{"setNum": setNum }]);
                saveResultsCallback(task.taskName, [{"taskStarted": true}]);
            }
        } else {
            node.on_timeline_start = () => {
                saveResultsCallback(task.taskName, [{"taskStarted": true}]);
            }
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
        case "face-name":
            return new FaceName(options.setNum || 1);
        case "ffmq":
            return new Ffmq();
        case "flanker":
            const setNum = options.setNum || 1;
            return new Flanker(setNum);
        case "mind-in-eyes":
            return new MindEyes(options.setNum || 1);
        case "mood-memory":
            return new MoodMemory();
        case "mood-prediction":
            return new MoodPrediction();
        case "panas":
            return new Panas();
        case "pattern-separation-learning":
            return new PatternSeparation(options.setNum || 1, false);
        case "pattern-separation-recall":
            return new PatternSeparation(options.setNum || 1, true);
        case "physical-activity":
            return new PhysicalActivity();
        case "spatial-orientation":
            return new SpatialOrientation(options.setNum || 1);
        case "task-switching":
            return new TaskSwitching();
        case "verbal-fluency":
            const allResults = options.allResults;
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
        case "verbal-learning-learning":
            return new VerbalLearning(options.setNum || 1, 1);
        case "verbal-learning-recall":
            return new VerbalLearning(options.setNum || 1, 2, verbalLearningEndTime.bind(this));
        default:
           // throw new Error(`Unknown task type: ${name}`);
           return {getTimeline: () => taskNotAvailable(name), taskName: name}; // TODO remove this and throw error instead once we have code for all tasks
    }
}

async function verbalLearningEndTime() {
    const vlResults = await getExperimentResultsForCurrentUser(userSession, 'verbal-learning-learning');
    if (vlResults.length === 0) {
        return 0;
    }
    const last = vlResults[vlResults.length - 1];
    const parsedDate = Date.parse(last.dateTime);
    return parsedDate;
}


/**
 * Users may only start the next set if:
 * (a) They are in between sets and
 *    (1) They completed the last set >= 1 hour ago or
 *    (2) The last set took them >3 hours to complete
 * or
 * (b) They are in the middle of a set that they started >3 hours ago
 * See https://github.com/EmotionCognitionLab/pvs/issues/68
 * @param {Object[]} allResults All results for the user, as returned by ../common/db/db.js:getAllResultsForCurrentUser()
 * @returns true if the user can start the next set, false otherwise
 */
function canStartNextSet(allResults) {
    if (allResults.length === 0) return false;

    const setStarts = allResults.filter(r => r.experiment === setStarted);
    const setFinishes = allResults.filter(r => r.experiment === setFinished);
    const setNumsStarted = new Set(setStarts.map(ss => ss.results.setNum));
    const setNumsFinished = new Set(setFinishes.map(sf => sf.results.setNum));
    let inBetweenSets = true;
    for (let setNum of setNumsStarted) if (!setNumsFinished.has(setNum)) inBetweenSets = false;
    inBetweenSets = inBetweenSets && (setNumsStarted.size == setNumsFinished.size);

    if (inBetweenSets) {
        const lastSetStartedAt = Date.parse(setStarts[setStarts.length - 1].dateTime);
        const lastSetFinishedAt = Date.parse(setFinishes[setFinishes.length - 1].dateTime);
        return Date.now() - lastSetFinishedAt >= 1 * 60 * 60 * 1000 ||
            (lastSetFinishedAt - lastSetStartedAt > 3 * 60 * 60 * 1000);
    } else {
        const lastSetStartedAt = Date.parse(setStarts[setStarts.length - 1].dateTime);
        return Date.now() - lastSetStartedAt > 3 * 60 * 60 * 1000;
    }
}

function init() {
    const lStor = window.localStorage;
    const scopes = [];
    if (!lStor.getItem(`${browserCheck.appName}.${browserCheck.uaKey}`)) {
        // we may have a new user who needs phone # verification
        scopes.push('openid');
        scopes.push('aws.cognito.signin.user.admin');
    }
    const cognitoAuth = getAuth(doAll, handleError, null, scopes);
    cognitoAuth.getSession();
}

async function doAll(session) {
    // pre-fetch all results before doing browser check to avoid
    // lag after btowser check sends them to start experiments
    userSession = session;
    const allResults = await getAllResultsForCurrentUser(session);
    browserCheck.run(startTasks.bind(null, allResults));
}

function startTasks(allResults) {
    const setAndTasks = getSetAndTasks(allResults, saveResultsCallback);
    runTask(setAndTasks.remainingTasks, 0, saveResultsCallback)
}

function runTask(tasks, taskIdx, saveResultsCallback=saveResultsCallback) {
    if (taskIdx >= tasks.length) {
        logger.error(`Was asked to run task ${taskIdx}, but tasks array max index is ${tasks.length - 1}`);
        return;
    }
    tasks[taskIdx].on_timeline_finish = () => {
        saveResultsCallback(tasks[taskIdx].taskName, [{ua: window.navigator.userAgent}]);
        if (taskIdx === tasks.length - 2) { // -2 b/c the "all done" screen is its own timeline that will never finish b/c there's nothing to do on that screen
            saveResultsCallback(setFinished, [{ "setNum": tasks[taskIdx].setNum }]);
        } 
        if (taskIdx < tasks.length - 1) {
            runTask(tasks, taskIdx + 1, saveResultsCallback);
        }
    };
    jsPsych.init({
        timeline: [tasks[taskIdx]],
        on_data_update: (data) => {
            saveResultsCallback(tasks[taskIdx].taskName, [data])
        }
    });
}

function saveResultsCallback(experimentName, results) {
    const cognitoAuth = getAuth(session => {
        saveResults(session, experimentName, results);
    }, handleError);
    cognitoAuth.getSession();
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
}

const fullScreenNode = {
    timeline: [fullScreenTrial],
    conditional_function: function() {
        return !(document.fullscreenElement || document.webkitFullscreenElement ||
        document.mozFullScreenElement || document.msFullscreenElement)
    }
}

const startNewSetQueryTask = {
    type: "html-button-response",
    stimulus: "You have finished one set of experiments. Would you like to start the next set? It will take about 40 minutes.",
    choices: ["I'll do it later", "Start"],
    on_finish: function(data) {
        if(data.response === 0){
            jsPsych.endExperiment("Thanks! You're all done for today.");
        }
    }
}

const allDoneMessage = {
    type: "html-button-response",
    stimulus: "Congratulations! You have done all of the daily measurements required for this part of the experiment. You may close this window.",
    choices: [],
};

const doneForTodayMessage = {
    type: "html-button-response",
    stimulus: "Congratulations! You have done all of the daily measurements for today. Please come back tomorrow to continue.",
    choices: [],
};


if (window.location.href.includes("daily-tasks")) {
    init();
}

export { getSetAndTasks, allSets, taskForName, doneForToday, allDone, runTask, setFinished, setStarted, startNewSetQuery }



