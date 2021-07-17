'use strict';

import "@adp-psych/jspsych/jspsych.js";
import { DailyStressors } from "../daily-stressors/daily-stressors.js";
import { Flanker } from "../flanker/flanker.js";
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { MoodPrediction } from "../mood-prediction/mood-prediction.js";
import { Panas } from "../panas/panas.js";
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";
import { getAuth } from "../../../common/auth/dist/auth.js";
import { saveResults, getAllResultsForCurrentUser } from "../../../common/db/dist/db.js";

/**
 * Module for determining which baselne tasks a user should be doing at the moment and presenting them
 * to the user in the correct order.
 */

const set1 = ["panas", "daily-stressors", "dass", "n-back", "mind-in-eyes", "verbal-fluency", "flanker", "face-name", "spatial-orientation"];
const set2 = ["panas", "daily-stressors", "pattern-separation", "n-back", "verbal-fluency", "pattern-separation", "mind-in-eyes", "flanker", "face-name"];
const set3 = ["panas", "daily-stressors", "task-switching", "mind-in-eyes", "verbal-fluency", "face-name", "n-back", "spatial-orientation", "flanker"];
const set4 = ["panas", "daily-stressors", "pattern-separation", "spatial-orientation", "verbal-fluency", "n-back", "pattern-separation", "mind-in-eyes", "flanker", "face-name"];
const set5 = ["panas", "daily-stressors", "mindfulness", "verbal-learning", "face-name", "n-back", "mind-in-eyes", "face-name", "spatial-orientation", "verbal-fluency", "flanker"];
const set6 = ["mood-memory", "panas", "daily-stressors", "pattern-separation", "n-back", "verbal-fluency", "spatial-orientation", "pattern-separation", "mind-in-eyes", "flanker", "face-name"];
const allSets = [set1, set2, set3, set4, set5, set6];
const setFinished = "set-finished";
const setStarted = "set-started";
const doneForToday = "done-for-today";
const allDone = "all-done";

/**
 * 
 * @param {Object[]} allResults All results for the current user as returned by db.getAllResultsForCurrentUser. These must be sorted by date from earliest to latest.
 * @param {Function} saveResultsCallback Callback function used to save results of each task. Should accept experimentName (string) and results (array) parameters.
 * @returns {Object} Object with fields 'set' (current set number) and 'remainingTasks' (array of remaining tasks in current set)
 */
// TODO no need to return set
function getSetAndTasks(allResults, saveResultsCallback) {
    const completedTasks = dedupeExperimentResults(allResults.map(r => r.experiment));
    const nextSetOk = canStartNextSet(allResults);
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
                    // started their most recent set today
                    // participants can only start one set per day
                    return { set: setNum, remainingTasks: [{timeline: [doneForTodayMessage], taskName: doneForToday}] };
                }
                // they didn't finish this set - return the remaining tasks
                remainingTasks = set.slice(j)
                const timeline = tasksForSet(remainingTasks, setNum, allResults, saveResultsCallback);
                if (j > 0 && nextSetOk) {
                    timeline.push(startNewSetQueryTask); // give them the choice to start the next set
                    timeline.push(tasksForSet(allSets[i+1], setNum + 1, allResults, saveResultsCallback));
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
function tasksForSet(remainingTaskNames, setNum, allResults, saveResultsCallback) {
    const allTimelines = [];
    const atSetStart = remainingTaskNames.length === allSets[setNum - 1].length &&
        remainingTaskNames.every((item, idx) => item === allSets[setNum - 1][idx]);

    for  (let i = 0; i < remainingTaskNames.length; i++) {
        const task = taskForName(remainingTaskNames[i], {setNum: setNum, allResults: allResults});
        const node = {
            timeline: task.getTimeline(),
            taskName: task.taskName,
            on_timeline_finish: () => {
                saveResultsCallback(task.taskName, jsPsych.data.getLastTimelineData().values());
                if (i === remainingTaskNames.length - 1) {
                    saveResultsCallback(setFinished, [{ "setNum": setNum }]);
                }
            }
        }
        if (i === 0 && atSetStart) {
            node.on_timeline_start = () => {
                saveResultsCallback(setStarted, [{"setNum": setNum }]);
            }
        }
        allTimelines.push(node);
    }
    if (setNum === allSets.length) {
        allTimelines.push({timeline: [allDoneMessage], taskName: allDone});
    } else {
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
        case "flanker":
            const setNum = options.setNum || 1;
            return new Flanker(setNum);
        case "mood-memory":
            return new MoodMemory();
        case "mood-prediction":
            return new MoodPrediction();
        case "panas":
            return new Panas(); 
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
        case "verbal-learning":
            return new VerbalLearning();
        default:
           // throw new Error(`Unknown task type: ${name}`);
           return {getTimeline: () => taskNotAvailable(name), taskName: name}; // TODO remove this and throw error instead once we have code for all tasks
    }
}


/**
 * Users may only start the next set if (a) they started the previous one yesterday or earlier and (b) at least one hour ago.
 * Example: If it is Tuesday at 12:17AM and the user started the previous set Monday at 11:43PM they can't start the next set.
 * @param {Object[]} allResults All results for the user, as returned by ../common/db/db.js:getAllResultsForCurrentUser()
 * @returns true if the user can start the next set, false otherwise
 */
function canStartNextSet(allResults) {
    const mostRecentStart = allResults.filter(r => r.experiment === setStarted).reverse()[0];
    if (!mostRecentStart) {
        return true;
    }
    const lastSetStart = new Date(mostRecentStart.dateTime);
    const now = new Date();
    const yesterday = new Date(now.valueOf() - (1000 * 60 * 60 * 24));
    return lastSetStart < yesterday || 
        (lastSetStart.getDate() === yesterday.getDate() && lastSetStart.valueOf <= now.valueOf - (1000 * 60 * 60));
}

function startTasks() {
    const cognitoAuth = getAuth(fetchResults, handleError);
    cognitoAuth.getSession();
}

async function fetchResults(session) {
    const allResults = await getAllResultsForCurrentUser(session);
    const setAndTasks = getSetAndTasks(allResults, saveResultsCallback);
    jsPsych.init({
        timeline: setAndTasks.remainingTasks
    });
}

function saveResultsCallback(experimentName, results) {
    const cognitoAuth = getAuth(session => {
        saveResults(session, experimentName, results);
    }, handleError);
    cognitoAuth.getSession();
}

function handleError(err) {
    // TODO set up remote error logging
    console.log(err);
}

function taskNotAvailable(taskName) {
    return [{
        type: "html-button-response",
        stimulus: `The code for ${taskName} has not been written yet. Please continue to the next task.`,
        choices: ["Continue"]
    }];
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
    startTasks();
}

export { getSetAndTasks, allSets, taskForName, doneForToday, allDone, setFinished, setStarted }



