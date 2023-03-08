'use strict';

import { DailyStressors } from "../daily-stressors/daily-stressors.js";
import { Dass } from "../dass/dass";
import { Demographics } from "../demographics/demographics.js";
import { FaceName } from "../face-name/face-name.js";
import { Ffmq } from "../ffmq/ffmq.js";
import { Flanker } from "../flanker/flanker.js";
import * as dailyTasks from "../daily-tasks/daily-tasks.js";
import { MindEyes } from "../mind-eyes/mind-eyes.js";
import { MoodPrediction  } from "../mood-prediction/mood-prediction.js";
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { NBack } from "../n-back/n-back.js";
import { Panas } from "../panas/panas.js";
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";
import { clickContinue, clickIcirc, pressKey } from "./utils.js";
import { TaskSwitching } from "../task-switching/task-switching.js";
import { PatternSeparation } from "../pattern-separation/pattern-separation.js";
import { PhysicalActivity } from "../physical-activity/physical-activity.js";
import { SpatialOrientation } from "../spatial-orientation/spatial-orientation.js";
import version from "../version.json";
import "jest-canvas-mock";
require("@adp-psych/jspsych/jspsych.js");

describe("getSetAndTasks", () => {
    it("returns the set and remaining tasks in the set", () => {

        const input = buildInput( [{ taskNames: dailyTasks.allSets[0].slice(0, 2), setNum: 1 }] );
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(1);
        const expectedTaskNames = dailyTasks.allSets[0].slice(input.length - 1); // -1 because the input includes a set-started record
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("returns the next set and all tasks in it if all tasks in the previous set have been completed and the previous set was finished more than one hour ago", () => {
        const now = Date.now();
        const moreThanAnHourAgo = new Date(now - ((1000 * 60 * 60 * 1) + 1));
        const input = buildInput( [{ 
            taskNames: dailyTasks.allSets[0], 
            setStartedTime: new Date(now - (1000 * 60 * 60 * 1.8)).toISOString(),
            setFinishedTime: moreThanAnHourAgo.toISOString(),
            setNum: 1
        }]);
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(2);
        const expectedTaskNames = dailyTasks.allSets[result.set - 1];
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("returns an 'all done for today' message if all tasks in the previous set were completed less than an hour ago and the set took less than 3 hours to complete", () => {
        const now = Date.now();
        const lessThanAnHourAgo = new Date(now - (1000 * 60 * 60 * 0.5));
        const input = buildInput( [{
            taskNames: dailyTasks.allSets[0], 
            setStartedTime: new Date(now - (1000 * 60 * 60 * 1)).toISOString(),
            setFinishedTime: lessThanAnHourAgo.toISOString(),
            setNum: 1
        }]);
        const results = dailyTasks.getSetAndTasks(input);
        const remainingTaskNames = results.remainingTasks.map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual([dailyTasks.doneForToday]);
    });

    it("lets you start the next set if the previous set took you more than three hours to complete, even if you just finished it", () => {
        const now = Date.now();
        const moreThanThreeHoursAgo = new Date(now - 1000 * 60 * 60 * 3.01);
        const input = buildInput( [{
            taskNames: dailyTasks.allSets[0],
            setStartedTime: moreThanThreeHoursAgo.toISOString(),
            setFinishedTime: new Date(now).toISOString(),
            setNum: 1
        }]);
        const results = dailyTasks.getSetAndTasks(input);
        const remainingTaskNames = results.remainingTasks.map(t => t.taskName);
        const secondSetTasks = dailyTasks.allSets[1];
        expect(remainingTaskNames).toEqual(expect.arrayContaining(secondSetTasks));
    });

    it("gives you the option to start a new set if you're finishing a set that you started more than three hours ago", () => {
        const fourHoursAgo = new Date(Date.now() - (1000 * 60 * 60 * 4));
        const doneTasksIdx = 3;
        const input = buildInput( [{
            taskNames: dailyTasks.allSets[0].slice(0, doneTasksIdx), 
            setStartedTime: fourHoursAgo.toISOString(),
            setNum: 1
        }]);
        const results = dailyTasks.getSetAndTasks(input);
        const remainingTaskNames = results.remainingTasks.map(t => t.taskName);
        expect(remainingTaskNames).toContain(dailyTasks.startNewSetQuery);
        const remainingFirstSetTasks = dailyTasks.allSets[0].slice(doneTasksIdx);
        expect(remainingTaskNames).toEqual(expect.arrayContaining(remainingFirstSetTasks));
        const secondSetTasks = dailyTasks.allSets[1];
        expect(remainingTaskNames).toEqual(expect.arrayContaining(secondSetTasks));
    });

    it("saves a set-finished record when you finish a set that is followed by the chance to start another set", () => {
        const fourHoursAgo = new Date(Date.now() - (1000 * 60 * 60 * 4));
        const doneTasksIdx = 3;
        const startSet = 1;
        const input = buildInput( [{
            taskNames: dailyTasks.allSets[0].slice(0, doneTasksIdx), 
            setStartedTime: fourHoursAgo.toISOString(),
            setNum: startSet
        }]);
        const saveResultsMock = jest.fn();
        const results = dailyTasks.getSetAndTasks(input, saveResultsMock);
        const remainingTaskNames = results.remainingTasks.map(t => t.taskName);
        expect(remainingTaskNames).toContain(dailyTasks.startNewSetQuery);

        const lastTaskFirstSetIdx = dailyTasks.allSets[0].slice(doneTasksIdx).length - 1;
        dailyTasks.runTask(results.remainingTasks, lastTaskFirstSetIdx, saveResultsMock);
        expect(results.remainingTasks[lastTaskFirstSetIdx].on_timeline_finish).toBeDefined();
        results.remainingTasks[lastTaskFirstSetIdx].on_timeline_finish();
        expect(saveResultsMock).toHaveBeenCalled();
        const taskNames = saveResultsMock.mock.calls.map(c => c[0]);
        expect(taskNames).toContain(dailyTasks.setFinished);
        for (const call of saveResultsMock.mock.calls) {
            if (call[0] === dailyTasks.setFinished) expect(call[1][0]).toEqual({setNum: startSet});
        }
    });

    it("saves a set-finished record when you finish a set that was immediately preceded by another set", () => {
        const fourHoursAgo = new Date(Date.now() - (1000 * 60 * 60 * 4));
        const doneTasksIdx = 3;
        const startSet = 1;
        const input = buildInput( [{
            taskNames: dailyTasks.allSets[0].slice(0, doneTasksIdx), 
            setStartedTime: fourHoursAgo.toISOString(),
            setNum: startSet
        }]);
        const saveResultsMock = jest.fn();
        const results = dailyTasks.getSetAndTasks(input, saveResultsMock);
        const remainingTaskNames = results.remainingTasks.map(t => t.taskName);
        expect(remainingTaskNames).toContain(dailyTasks.startNewSetQuery);

        const lastTaskSecondSetIdx = results.remainingTasks.length - 2; // -2 b/c the last one is just "done-for-today"
        dailyTasks.runTask(results.remainingTasks, lastTaskSecondSetIdx, saveResultsMock);
        expect(results.remainingTasks[lastTaskSecondSetIdx].on_timeline_finish).toBeDefined();
        results.remainingTasks[lastTaskSecondSetIdx].on_timeline_finish();
        expect(saveResultsMock).toHaveBeenCalled();
        const taskNames = saveResultsMock.mock.calls.map(c => c[0]);
        expect(taskNames).toContain(dailyTasks.setFinished);
        for (const call of saveResultsMock.mock.calls) {
            if (call[0] === dailyTasks.setFinished) expect(call[1][0]).toEqual({setNum: startSet + 1});
        }
    });

    it("does not give you the option to start a new set if you're finishing a set that you started less than three hours ago", () => {
        const twoHoursAgo = new Date(Date.now() - (1000 * 60 * 60 * 2));
        const doneTasksIdx = 4;
        const input = buildInput( [{
            taskNames: dailyTasks.allSets[0].slice(0, doneTasksIdx),
            setStartedTime: twoHoursAgo,
            setNum: 1
        }]);
        const results = dailyTasks.getSetAndTasks(input);
        const remainingTaskNames = results.remainingTasks.map(t => t.taskName);
        expect(remainingTaskNames).not.toContain(dailyTasks.startNewSetQuery);
        const remainingFirstSetTasks = dailyTasks.allSets[0].slice(doneTasksIdx);
        expect(remainingTaskNames).toEqual(expect.arrayContaining(remainingFirstSetTasks));
    });

    it("starts at first missed task if completed tasks are not in the expected order", () => {
        const input = buildInput([{ taskNames: [dailyTasks.allSets[0][0], dailyTasks.allSets[0][2]], setNum: 1 }]);
        const results = dailyTasks.getSetAndTasks(input);
        expect(results.remainingTasks[0].taskName).toBe(dailyTasks.allSets[0][1]);
    });

    it("should include an 'all-done' message (and only that message) if the user has completed all tasks in all sets", () => {
        const setList = dailyTasks.allSets.map( (s, idx) => ( { 
            taskNames: s,
            setStartedTime: new Date(Date.now() - (1000 * 60 * 60 * 2)).toISOString(),
            setFinishedTime: new Date(Date.now() - (1000 * 60 * 60 * 1)).toISOString(),
            setNum: idx + 1 }
        ));
        
        const input = buildInput(setList);
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.remainingTasks.length).toBe(1);
        expect(result.remainingTasks[0].taskName).toBe(dailyTasks.allDone);
    });

    it("should handle cases where an experiment has multiple results in a row", () => {
        const inputTasks = dailyTasks.allSets[0].slice(0, 5);
        const input = [];
        inputTasks.forEach(t => { input.push(t); input.push(t); } );
        expect(input.length).toBe(2 * inputTasks.length);
        const result = dailyTasks.getSetAndTasks(buildInput( [{taskNames: input, setNum: 1}] ));
        expect(result.set).toBe(1);
        const expectedTaskNames = dailyTasks.allSets[result.set - 1].slice(5);
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("should not consider experiments as completed if they don't have at least one relevant result", () => {
        const lastValidTaskIdx = 2;
        const inputTasks = dailyTasks.allSets[0].slice(0, lastValidTaskIdx + 1);
        const input = buildInput( [{taskNames: inputTasks, setNum: 1}]);
        input[3].isRelevant = false;
        const result = dailyTasks.getSetAndTasks(input);
        const expectedTaskNames = dailyTasks.allSets[0].slice(lastValidTaskIdx);
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("should return remaining tasks when the number of characters in the first uncompleted task name is less than or equal to the number of completed tasks", () => {
        const inputSets = [ {
            taskNames: dailyTasks.allSets[0],
            setNum: 1,
            setStartedTime: new Date(Date.now() - (1000 * 60 * 60 * 5)).toISOString(),
            setFinishedTime: new Date(Date.now() - (1000 * 60 * 60 * 4)).toISOString()
        },
        {
            taskNames: dailyTasks.allSets[1].slice(0, dailyTasks.allSets[1].length - 2),
            setNum: 2,
            setStartedTime: new Date(Date.now() - (1000 * 60 * 60 * 2)).toISOString(),
        }
        ];
        
        const expectedTaskNames = dailyTasks.allSets[1].slice(dailyTasks.allSets[1].length - 2);
        expect(expectedTaskNames[0].length).toBeLessThanOrEqual(inputSets[0].taskNames.concat(inputSets[1].taskNames).length);
        const input = buildInput(inputSets);
        const result = dailyTasks.getSetAndTasks(input);
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("should include a 'done-for-today' message after the user finishes the last task for the day", () => {
        const input = buildInput( [{ taskNames: dailyTasks.allSets[0].slice(0, 2), setNum: 1 }] );
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.remainingTasks[result.remainingTasks.length -1].taskName).toBe(dailyTasks.doneForToday);
    });

    it("should include an 'all-done' message when the user finishes the last task of the pre-intervention baseline sets", () => {
        const setList = dailyTasks.allSets.slice(0, dailyTasks.preInterventionSetCount).map( (s, idx) => ( { 
            taskNames: s,
            setStartedTime: new Date(Date.now() - (1000 * 60 * 60 * 2)).toISOString(),
            setFinishedTime: new Date(Date.now() - (1000 * 60 * 60 * 1)).toISOString(),
            setNum: idx + 1 }
        ));
        
        const lastSetTasks = setList[setList.length - 1].taskNames;
        setList[setList.length - 1].taskNames = lastSetTasks.slice(0, lastSetTasks.length - 2);
        const result = dailyTasks.getSetAndTasks(buildInput(setList));
        expect(result.remainingTasks[result.remainingTasks.length - 1].taskName).toBe(dailyTasks.allDone);
    });

    it("should include an 'all-done' message when the user finishes the last task of the last set", () => {
        const setList = dailyTasks.allSets.map( (s, idx) => ( { 
            taskNames: s,
            setStartedTime: new Date(Date.now() - (1000 * 60 * 60 * 2)).toISOString(),
            setFinishedTime: new Date(Date.now() - (1000 * 60 * 60 * 1)).toISOString(),
            setNum: idx + 1 }
        ));
        const lastSetTasks = setList[setList.length - 1].taskNames;
        setList[setList.length - 1].taskNames = lastSetTasks.slice(0, lastSetTasks.length - 2);
        const result = dailyTasks.getSetAndTasks(buildInput(setList));
        expect(result.remainingTasks[result.remainingTasks.length - 1].taskName).toBe(dailyTasks.allDone);
    });

    it("should return all of the tasks the first set if you have started the set today but have not yet done any tasks", () => {
        const result = dailyTasks.getSetAndTasks(buildInput([ { taskNames: [], setNum: 1 } ]));
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(dailyTasks.allSets[0]);
    });

    it("should have you start the next set if you (a) have a set-started record and (b) lack a corresponding set-finished record and (c) have done all of the tasks in the set and (d) you took > 3 hours to do your last set", () => {
        const startTime = new Date(Date.now() - (1000 * 60 * 60 * 3.1)).toISOString(); // > 3 hours ago
        const setNum = 1;
        const input = buildInput([{setNum: setNum, setStartedTime: startTime, taskNames: dailyTasks.allSets[setNum - 1]}]);
        const saveResultsMock = jest.fn();
        const result = dailyTasks.getSetAndTasks(input, saveResultsMock);
        expect(result.set).toBe(setNum + 1);
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(dailyTasks.allSets[setNum]);
    });

    it("should save a new set-finished record if you (a) have a set-started record and (b) lack a corresponding set-finished record and (c) have done all of the tasks in the set", () => {
        const setNum = 3;
        const input = buildInput([{setNum: setNum, taskNames: dailyTasks.allSets[setNum - 1]}]);
        const saveResultsMock = jest.fn();
        dailyTasks.getSetAndTasks(input, saveResultsMock);
        expect(saveResultsMock).toHaveBeenCalled();
        expect(saveResultsMock.mock.calls[0][0]).toBe(dailyTasks.setFinished);
        expect(saveResultsMock.mock.calls[0][1]).toStrictEqual({"setNum": setNum});
    });

    it("works for the post-intervention sets as well", () => {
        const input = buildInput( [{ taskNames: dailyTasks.allSets[7].slice(0, 2), setNum: 8 }] );
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(8);
        const expectedTaskNames = dailyTasks.allSets[7].slice(input.length - 1); // -1 because the input includes a set-started record
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("does allow you to start post-intervention sets when homeComplete is true", () => {
        dailyTasks.setHomeComplete(true);
        const setList = dailyTasks.allSets.slice(0, dailyTasks.preInterventionSetCount).map( (s, idx) => ( { 
            taskNames: s,
            setStartedTime: new Date(Date.now() - (1000 * 60 * 60 * 47)).toISOString(),
            setFinishedTime: new Date(Date.now() - (1000 * 60 * 60 * 46)).toISOString(),
            setNum: idx + 1 }
        ));
        const lastSetTasks = setList[setList.length - 1].taskNames;
        setList[setList.length - 1].taskNames = lastSetTasks.slice(0, lastSetTasks.length - 2);
        const result = dailyTasks.getSetAndTasks(buildInput(setList));
        const expectedTaskNames = dailyTasks.allSets[dailyTasks.preInterventionSetCount];
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
        expect(result.remainingTasks[result.remainingTasks.length - 1].taskName).toBe(dailyTasks.doneForToday);
    });
});

describe("taskForName for verbal-fluency", () => {
    it("returns a VerbalFluency object", () => {
        const result = dailyTasks.taskForName("verbal-fluency", { 
            allResults: 
                [
                    {experiment: "verbal-fluency", isRelevant: true, results: {letter: "a"}}
                ],
            setNum: 2
        });
        expect(result instanceof VerbalFluency).toBe(true);
    });

    it("throws an error if all possible letters have already been used", () => {
        const input = VerbalFluency.possibleLetters.map(l => (
            { 
                experiment: "verbal-fluency",
                isRelevant: true,
                results: { letter: l }
            }
        ));
        function callWithAllLetters() {
            dailyTasks.taskForName("verbal-fluency", { allResults: input, setNum: 3 });
        }
        expect(callWithAllLetters).toThrowError("All of the verbal fluency tasks have been completed.");
    });

    it("returns a VerbalFluency object with a letter that has not been used", () => {
        const input = VerbalFluency.possibleLetters.slice(1).map(l => (
            { 
                experiment: "verbal-fluency",
                isRelevant: true,
                results: { letter: l }
            }
        ));
        const result = dailyTasks.taskForName("verbal-fluency", { allResults: input, setNum: 1 });
        expect(result.letter).toBe(VerbalFluency.possibleLetters[0]);
    });

    it("ignores letters used pre-intervention when doing post-intervention sets", () => {
        const input = VerbalFluency.possibleLetters.map(l => (
            { 
                experiment: "verbal-fluency",
                isRelevant: true,
                results: { letter: l }
            }
        ));
        const result = dailyTasks.taskForName("verbal-fluency", { allResults: input, setNum: 7 });
        expect(VerbalFluency.possibleLetters).toContain(result.letter);
    });

    it("throws an error if all possible letters have been used post-intervention", () => {
        const allResults = [];
        for (let i = 0; i < VerbalFluency.possibleLetters.length; i++) {
            allResults.push({experiment: "verbal-fluency", results: {setNum: i + 1, taskStarted: true}});
            allResults.push(
                { 
                    experiment: "verbal-fluency",
                    isRelevant: true,
                    results: { letter: VerbalFluency.possibleLetters[i] }
                }
            );
        }
        for (let i = 0; i < VerbalFluency.possibleLetters.length; i++) {
            allResults.push({experiment: "verbal-fluency", results: {setNum: i + 7, taskStarted: true}});
            allResults.push(
                { 
                    experiment: "verbal-fluency",
                    isRelevant: true,
                    results: { letter: VerbalFluency.possibleLetters[i] }
                }
            );
        }
        function callWithAllLetters() {
            dailyTasks.taskForName("verbal-fluency", { allResults: allResults, setNum: 11 });
        }
        expect(callWithAllLetters).toThrowError("All of the verbal fluency tasks have been completed.");
    });

});

describe("taskForName", () => {
    it.skip("throws an error if given the name of an unknown task", () => { // TODO remove skip when we have classes defined for all tasks
        const badTaskName = "jkafkjefij";
        function callWithBadTaskName() {
            dailyTasks.taskForName(badTaskName);
        }
        expect(callWithBadTaskName).toThrowError(`Unknown task type: ${badTaskName}`);
    });
    it("returns a DailyStressors object for daily-stressors", () => {
        const result = dailyTasks.taskForName("daily-stressors", {});
        expect(result instanceof DailyStressors).toBe(true);
    });
    it("returns a Dass object for dass", () => {
        const result = dailyTasks.taskForName("dass", {});
        expect(result instanceof Dass).toBe(true);
    });
    it("returns a Demographics object for demographics", () => {
        const result = dailyTasks.taskForName("demographics", {});
        expect(result instanceof Demographics).toBe(true);
    });
    it("returns a Ffmq object for ffmq", () => {
        const result = dailyTasks.taskForName("ffmq", {});
        expect(result instanceof Ffmq).toBe(true);
    });
    it("returns a MoodMemory object for mood-memory", () => {
        const result = dailyTasks.taskForName("mood-memory", {});
        expect(result instanceof MoodMemory).toBe(true);
    });
    it("returns a MoodPrediction object for mood-prediction", () => {
        const result = dailyTasks.taskForName("mood-prediction", {});
        expect(result instanceof MoodPrediction).toBe(true);
    });
    it("returns a Panas object for panas", () => {
        const result = dailyTasks.taskForName("panas", {});
        expect(result instanceof Panas).toBe(true);
    });
    it("returns a PhysicalActivity object for physical-activity", () => {
        const result = dailyTasks.taskForName("physical-activity", {});
        expect(result instanceof PhysicalActivity).toBe(true);
    });
    it("returns a TaskSwitching object for task-switching", () => {
        const result = dailyTasks.taskForName("task-switching", {});
        expect(result instanceof TaskSwitching).toBe(true);
    });
});

describe("taskForName for flanker", () => {
    it("returns a Flanker object for flanker", () => {
        const result = dailyTasks.taskForName("flanker", {setNum: 2});
        expect(result instanceof Flanker).toBe(true);
    });
    it("defaults to set 1 if no set number is provided", () => {
        const set1Result = dailyTasks.taskForName("flanker", {setNum: 1});
        const noSetResult = dailyTasks.taskForName("flanker", {});
        expect(JSON.stringify(noSetResult.getTimeline())).toBe(JSON.stringify(set1Result.getTimeline()));
    });
});

describe("taskForName for face-name", () => {
    it("returns a FaceName object for face-name", () => {
        const result = dailyTasks.taskForName("face-name", {setNum: 3});
        expect(result instanceof FaceName).toBe(true);
    });

    it("defaults to set 1 if no set number is provided", () => {
        const set1Result = dailyTasks.taskForName("face-name", {setNum: 1});
        const noSetResult = dailyTasks.taskForName("face-name", {});
        const set1Timeline = set1Result.getTimeline();
        const noSetTimeline = noSetResult.getTimeline();
        expect(noSetTimeline.length).toBe(set1Timeline.length);
        for (let i=0; i<set1Timeline.length; i++) {
            if (set1Timeline[i].timeline_variables) {
                expect(noSetTimeline[i].timeline_variables.length).toBe(set1Timeline[i].timeline_variables.length);
            }
        }
    });
});

describe("taskForName for mind-in-eyes", () => {
    it("returns a MindEyes object for mind-in-eyes", () => {
        const result = dailyTasks.taskForName("mind-in-eyes", {setNum: 4});
        expect(result instanceof MindEyes).toBe(true);
    });

    it("defaults to set 1 if no set number is provided", () => {
        const set1Result = dailyTasks.taskForName("mind-in-eyes", {setNum: 1});
        const noSetResult = dailyTasks.taskForName("mind-in-eyes", {});
        const set1Timeline = set1Result.getTimeline();
        const noSetTimeline = noSetResult.getTimeline();
        expect(noSetTimeline.length).toBe(set1Timeline.length);
        for (let i=0; i<set1Timeline.length; i++) {
            if (set1Timeline[i].timeline_variables) {
                expect(noSetTimeline[i].timeline_variables.length).toBe(set1Timeline[i].timeline_variables.length);
                noSetTimeline[i].timeline_variables.forEach(tlVar => expect(set1Timeline[i].timeline_variables).toContain(tlVar));
            }
        }
    });
});

describe("taskForName for n-back", () => {
    it("returns a NBack object for  n-back", () => {
        const result = dailyTasks.taskForName("n-back", {setNum: 2});
        expect(result instanceof NBack).toBe(true);
    });
    it("defaults to set 1 if no set number is provided", () => {
        const set1Result = dailyTasks.taskForName("n-back", {setNum: 1});
        const noSetResult = dailyTasks.taskForName("n-back", {});
        expect(noSetResult.getTimeline().length).toEqual(set1Result.getTimeline().length);
    });
});

describe("taskForName for pattern-separation", () => {
    it("returns a PatternSeparation object for pattern-separation-learning", () => {
        const result = dailyTasks.taskForName("pattern-separation-learning", {});
        expect(result instanceof PatternSeparation).toBe(true);
    });

    it("returns a PatternSeparation object for pattern-separation-recall", () => {
        const result = dailyTasks.taskForName("pattern-separation-recall", {});
        expect(result instanceof PatternSeparation).toBe(true);
    });

    it("returns a PatternSeparation object with isRecall=false for pattern-separation-learning", () => {
        const result = dailyTasks.taskForName("pattern-separation-learning", {});
        expect(result.isRecall).toBe(false);
    });

    it("returns a PatternSeparation object with isRecall=true for pattern-separation-recall", () => {
        const result = dailyTasks.taskForName("pattern-separation-recall", {});
        expect(result.isRecall).toBe(true);
    });

    it("defaults to set 1 if no set number is provided", () => {
        const set1Task = dailyTasks.taskForName("pattern-separation-learning", {setNum: 1});
        const noSetTask = dailyTasks.taskForName("pattern-separation-learning", {});
        expect(set1Task.setNum).toBe(1);
        expect(noSetTask.setNum).toBe(1);
    });
});

describe("taskForName for spatial-orientation", () => {
    it("returns a SpatialOrientation object for spatial-orientation", () => {
        const result = dailyTasks.taskForName("spatial-orientation", {setNum: 2});
        expect(result instanceof SpatialOrientation).toBe(true);
    });
    it("defaults to set 1 if no set number is provided", () => {
        const set1Result = dailyTasks.taskForName("spatial-orientation", {setNum: 1}).getTimeline();
        const noSetResult = dailyTasks.taskForName("spatial-orientation", {}).getTimeline();
        expect(set1Result.length).toEqual(noSetResult.length);
    });
});

describe("taskForName for verbal-learning", () => {
    it("returns a VerbalLearning object for verbal-learning-learning", () => {
        const result = dailyTasks.taskForName("verbal-learning-learning", {});
        expect(result instanceof VerbalLearning).toBe(true);
    });

    it("returns a VerbalLearning object for verbal-learning-recall", () => {
        const result = dailyTasks.taskForName("verbal-learning-recall", {});
        expect(result instanceof VerbalLearning).toBe(true);
    });

    it("defaults to set 1 if no set number is provided", () => {
        const set1Task = dailyTasks.taskForName("verbal-learning-learning", {setNum: 1});
        const noSetTask = dailyTasks.taskForName("verbal-learning-learning", {});
        expect(set1Task.setNum).toBe(1);
        expect(noSetTask.setNum).toBe(1);
    });
});

describe("doing the tasks", () => {
    const saveResultsMock = jest.fn((_experimentName, _results) => null);
    const allTimelines = dailyTasks.getSetAndTasks([], saveResultsMock);

    afterEach(() => {
        jest.useRealTimers();
        saveResultsMock.mockClear();
    });
    it("should save the data at the end of each task", () => {
        const screenWidth = 222;
        const screenHeight = 333;
        jest.spyOn(window.screen, "width", "get").mockReturnValue(screenWidth);
        jest.spyOn(window.screen, "height", "get").mockReturnValue(screenHeight);
        jest.useFakeTimers("legacy");
        const remainingTasks = allTimelines.remainingTasks.slice(1); // slice to skip demographics
        dailyTasks.runTask(remainingTasks, 0, saveResultsMock); 
        // full-screen mode screen
        clickContinue();
        jest.runAllTimers();
        
        // video
        clickContinue();

        expect(saveResultsMock.mock.calls.length).toBe(5); // video task-started, video full-screen, video results, video user-agent, next task started
        // the experiment name saved to the results should be the name of the first task in allTimelines
        expect(saveResultsMock.mock.calls[3][0]).toBe(remainingTasks[0].taskName);
        // it should save the browser user agent as part of the results
        const ua = saveResultsMock.mock.calls[3][1].filter(r => r.ua);
        expect(ua.length).toBe(1);
        expect(ua[0].ua).toBe(window.navigator.userAgent);
        // it should save the screen size as part of the results
        const screen = saveResultsMock.mock.calls[3][1].filter(r => r.screen);
        expect(screen.length).toBe(1);
        expect(screen[0].screen).toBe(`${screenWidth}x${screenHeight}`);
        // it should save the application version as part of the results
        const vers = saveResultsMock.mock.calls[3][1].filter(r => r.v);
        expect(vers.length).toBe(1);
        expect(vers[0].v).toBe(version.v);
    });
    it("should save a 'set-finished' result at the end of a set", () => {
        const tasksToRun = allTimelines.remainingTasks.slice(allTimelines.remainingTasks.length - 2);
        jest.useFakeTimers("legacy");
        dailyTasks.runTask(tasksToRun, 0, saveResultsMock);
        // full-screen mode screen
        clickContinue();
        jest.runAllTimers();
        // spatial-orientation
        expect(tasksToRun[0].taskName).toBe("spatial-orientation");
        for (let i = 1; i < tasksToRun[0].timeline.length; i++) {
            const task = tasksToRun[0].timeline[i];
            if (task.type === "html-keyboard-response") {
                pressKey(" ");
            } else if (task.type === "spatial-orientation") {
                clickIcirc(document.getElementById("jspsych-spatial-orientation-icirc"), 0, 0);
                jest.advanceTimersByTime(task.lingerDuration);
            }
        }
        expect(saveResultsMock.mock.calls.length).toBe(
            1  // fullscreen
            + tasksToRun[0].timeline.length  // spatial-orientation trials (no weird control flow)
            + 2  // browser check and set finished
        );
        // check experiment name
        const lastRes = saveResultsMock.mock.calls.slice(-1)[0];
        expect(lastRes[0]).toBe(dailyTasks.setFinished);
        expect(lastRes[1]).toStrictEqual([{setNum: 1}]);
    });
    it("should save a 'set-started' result at the start of a set", () => {
        dailyTasks.runTask(allTimelines.remainingTasks, 0, saveResultsMock);
        expect(saveResultsMock.mock.calls.length).toBe(2);
        expect(saveResultsMock.mock.calls[0][0]).toBe(dailyTasks.setStarted);
        expect(saveResultsMock.mock.calls[0][1]).toStrictEqual([{setNum: 1}]);
    });
    it("should save a result showing the task started at the start of a task", () => {
        dailyTasks.runTask(allTimelines.remainingTasks, 0, saveResultsMock);
        expect(saveResultsMock.mock.calls.length).toBe(2);
        expect(saveResultsMock.mock.calls[1][0]).toBe(allTimelines.remainingTasks[0].taskName);
        expect(saveResultsMock.mock.calls[1][1]).toStrictEqual([{"taskStarted": true, "setNum": 1}]); // allTimeslines is using set 1
    });
    it("should put a full-screen task at the start of each experiment", () => {
        const firstTaskTypes = allTimelines.remainingTasks.slice(0, allTimelines.remainingTasks.length - 1)
            .map(rt => rt.timeline[0].timeline[0].type);
       expect(firstTaskTypes.every(tt => tt === "fullscreen")).toBe(true);
    });
    it("should display the full-screen task if the display is not already full screen", () => {
        dailyTasks.runTask(allTimelines.remainingTasks, 0, saveResultsMock);
        expect(jsPsych.getDisplayElement().innerHTML).toMatch(/full screen mode/);
    });
    it("should not display the full-screen task if the display is already full screen", () => {
        const origFsElement = document.fullscreenElement;
        global.document.fullscreenElement = true; // normally an HTMLElement, but daily-tasks just checks for existence
        dailyTasks.runTask(allTimelines.remainingTasks, 0, saveResultsMock);
        expect(jsPsych.getDisplayElement().innerHTML).not.toMatch(/full screen mode/);
        global.document.fullscreenElement = origFsElement;
    });
    // see https://github.com/EmotionCognitionLab/pvs/issues/158
    it("should decrease the flanker response time limit if they get >= 13 trials out of the first 16 correct", () => {
        const saveMock = jest.fn((_experimentName, results) => results.forEach(r => delete(r.isRelevant)));
        jest.useFakeTimers("legacy");
        const task = dailyTasks.taskForName("flanker", {setNum: 2});
        const timeline = task.getTimeline().slice(1); // skip preload
        const trialCount = timeline[1].timeline_variables.length;
        dailyTasks.runTask( [{timeline: timeline, taskName: task.taskName, setNum: 2}], 0, saveMock);
        pressKey(" ");
        for (let i = 0; i < trialCount; i++) {
            jest.advanceTimersByTime(800);
            const trial = jsPsych.currentTrial();
            const answer = trial.data.correct_response === "arrowright" ? "ArrowRight" : "ArrowLeft";
            pressKey(answer);
        }
        jest.advanceTimersByTime(800);
        const trial = jsPsych.currentTrial();
        expect(trial.trial_duration).toBe(Flanker.defaultResponseTimeLimitMs - 90);
    });
    it("should show a welcome page telling you how many sets of tasks there are when you first start", () => {
        dailyTasks.startTasks([], jest.fn());
        const html = jsPsych.getDisplayElement().innerHTML;
        expect(html).toMatch(/about to start set 1/);
    });
    it("should show a progress page telling you how many sets you have completed and which one you're doing for sets > 1", () => {
        const startTime = new Date(Date.now() - 1000 * 60 * 60 * 24);
        const endTime = new Date(Date.now() - 1000 * 60 * 60 * 23);
        const input = buildInput([{
            setNum: 1,
            setStartedTime: startTime.toISOString(),
            setFinishedTime: endTime.toISOString(),
            taskNames: dailyTasks.allSets[0]
        }]);
        dailyTasks.startTasks(input, jest.fn());
        const html = jsPsych.getDisplayElement().innerHTML;
        expect(html).toMatch(/You are on set 2/);
    });
    it("should not show a progress page if you've done all of the tasks for today", () => {
        const input = buildInput([{setNum: 1, setFinishedTime: new Date(), taskNames: dailyTasks.allSets[0]}]);
        dailyTasks.startTasks(input, jest.fn());
        const html = jsPsych.getDisplayElement().innerHTML;
        expect(html).toMatch(/You have done all of the daily measurements for today/);
    });
    it("should not show a progress page if you've done all of the tasks", () => {
        const allNames = dailyTasks.allSets.flatMap(t => t);
        const input = buildInput([{setNum: 12, setFinishedTime: new Date(), taskNames: allNames}]);
        dailyTasks.startTasks(input, jest.fn());
        const html = jsPsych.getDisplayElement().innerHTML;
        expect(html).toMatch(/You have done all of the daily measurements required/);
    });
});

/**
 * 
 * @param {*} setList Array of objects {
 *  taskNames: ["first task", "second task",...], 
 *  setStartedTime: ISO time string, (optional, defaults to now)
 *  setFinishedTime: ISO time string, (optional)
 *  setNum: number
 * }
 */
function buildInput(setList) {
    return setList.flatMap(s => {
        const startTime = s.setStartedTime || (new Date()).toISOString();
        let input = 
            [{experiment: dailyTasks.setStarted, dateTime: startTime, results: {setNum: s.setNum}}]
            .concat(s.taskNames.map(task => ({experiment: task, isRelevant: true, results: {} })));
        if (s.setFinishedTime) {
            input = input.concat({experiment: dailyTasks.setFinished, dateTime: s.setFinishedTime, results: {setNum: s.setNum}});
        }
        return input;
    });
}
