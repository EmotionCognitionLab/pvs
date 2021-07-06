'use strict';

import "@adp-psych/jspsych/jspsych.js";
import { DailyStressors } from "../daily-stressors/daily-stressors.js";
import { Flanker } from "../flanker/flanker.js";
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { MoodPrediction } from "../mood-prediction/mood-prediction.js";
import { Panas } from "../panas/panas.js";
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";

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

/**
 * 
 * @param {Object[]} allResults All results for the current user as returned by db.getAllResultsForCurrentUser. These must be sorted by date from earliest to latest.
 * @param {Function} saveResultsCallback Callback function used to save results of each task. Should accept experimentName (string) and results (array) parameters.
 * @returns {Object} Object with fields 'set' (current set number) and 'remainingTasks' (array of remaining tasks in current set)
 */
function getSetAndTasks(allResults, saveResultsCallback) {
    const completedTasks = allResults.map(r => r.experiment );
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
                if (j < task.length - 1) {
                    // they didn't finish this set - return the remaining tasks
                    remainingTasks = set.slice(j)
                }
                const setNum = i + 1;
                return { set: setNum, remainingTasks: tasksForSet(remainingTasks, setNum, allResults, saveResultsCallback) }
            }
        }
    }
    return { set: allSets.length, remainingTasks: [] }
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
    for  (let i = 0; i < remainingTaskNames.length; i++) {
        const task = taskForName(remainingTaskNames[i], {setNum: setNum, allResults: allResults});
        const node = {
            timeline: task.getTimeline(),
            taskName: task.taskName,
            on_timeline_finish: () => {
                saveResultsCallback(task.taskName, jsPsych.data.getLastTimelineData().json());
                if (i === remainingTaskNames.length - 1) {
                    saveResultsCallback("set-finished", { "setNum": setNum });
                }
            }
        }
        allTimelines.push(node);
    }
    return allTimelines;
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
            break;
        case "verbal-learning":
            return new VerbalLearning();
        default:
           // throw new Error(`Unknown task type: ${name}`);
           return {getTimeline: () => [], taskName: name}; // TODO remove this and throw error instead once we have code for all tasks
    }
}

export { getSetAndTasks, allSets, taskForName }



