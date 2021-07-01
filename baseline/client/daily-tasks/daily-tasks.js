'use strict';

import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js"

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
 * @param {array[Object]} allResults All results for the current user as returned by db.getAllResultsForCurrentUser. These must be sorted by date from earliest to latest.
 * @returns {Object} set: currentSetNumber, remainingTasks: list of remaining tasks in current set
 */
function getSetAndTasks(allResults) {
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
                return { set: i + 1, remainingTasks: remainingTasks }
            }
        }
    }
    return { set: allSets.length, remainingTasks: [] }
}

function taskForName(name, options) {
    switch(name) {
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
        default:
            throw new Error(`Unknown task type: ${name}`);
    }
}

export { getSetAndTasks, allSets, taskForName }


