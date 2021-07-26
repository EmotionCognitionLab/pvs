'use strict';

import { DailyStressors } from "../daily-stressors/daily-stressors.js";
import { Flanker } from "../flanker/flanker.js";
import * as dailyTasks from "../daily-tasks/daily-tasks.js";
import { MoodPrediction  } from "../mood-prediction/mood-prediction.js";
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { Panas } from "../panas/panas.js";
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";
import { clickContinue } from "./utils.js";
require("@adp-psych/jspsych/jspsych.js");

describe("getSetAndTasks", () => {
    it("returns the set and remaining tasks in the set", () => {
        const input = buildInput(dailyTasks.allSets[0].slice(0, 2));
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(1);
        const expectedTaskNames = dailyTasks.allSets[0].slice(input.length - 1); // -1 because the input includes a set-started record
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("returns the next set and all tasks in it if all tasks in the previous set have been ccompleted and the previous set was started yesterday or earlier", () => {
        const input = buildInput(dailyTasks.allSets[0], '2021-01-01T12:34:56.789Z');
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(2);
        const expectedTaskNames = dailyTasks.allSets[result.set - 1];
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("returns an 'all done for today' message if all tasks in the previous set were completed today", () => {
        const input = buildInput(dailyTasks.allSets[0], new Date().toISOString());
        const results = dailyTasks.getSetAndTasks(input);
        const remainingTaskNames = results.remainingTasks.map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual([dailyTasks.doneForToday]);
    });

    it("gives you the option to start a new set if you're finishing a set that you started yesterday", () => {
        const yesterdayMs = Date.now() - (1000 * 60 * 60 * 24);
        const yesterday = new Date(yesterdayMs);
        const doneTasksIdx = 3;
        const input = buildInput(dailyTasks.allSets[0].slice(0, doneTasksIdx), yesterday.toISOString());
        const results = dailyTasks.getSetAndTasks(input);
        const remainingTaskNames = results.remainingTasks.map(t => t.taskName);
        expect(remainingTaskNames).toContain(dailyTasks.startNewSetQuery);
        const remainingFirstSetTasks = dailyTasks.allSets[0].slice(doneTasksIdx);
        expect(remainingTaskNames).toEqual(expect.arrayContaining(remainingFirstSetTasks));
        const secondSetTasks = dailyTasks.allSets[1];
        expect(remainingTaskNames).toEqual(expect.arrayContaining(secondSetTasks));
    });

    it("does not give you the option to start a new set if you finished the last one yesterday but less than an hour ago", () => {
        const lastSetFinishedDate = '2021-01-02T23:32:00.000Z';
        const nowDateMs = Date.parse(lastSetFinishedDate).valueOf() + (1000 * 60 * 40);
        const input = buildInput(dailyTasks.allSets[0], lastSetFinishedDate);
        jest.spyOn(global.Date, 'now').mockImplementationOnce(() => nowDateMs);
        const results = dailyTasks.getSetAndTasks(input);
        expect(results.remainingTasks.length).toEqual(1);
        expect(results.remainingTasks.map(t => t.taskName)[0]).toEqual(dailyTasks.doneForToday);
    });

    it("throws an error if completed tasks are not in the expected order", () => {
        const input = buildInput([dailyTasks.allSets[0][0], dailyTasks.allSets[0][2]]);
        function callWithBadOrder() {
            dailyTasks.getSetAndTasks(input);
        }
        const expectedErrPatt = new RegExp(`^Expected ${dailyTasks.allSets[0][1]} but found ${dailyTasks.allSets[0][2]}.*$`);
        expect(callWithBadOrder).toThrowError(expectedErrPatt);
    });

    it("should include an 'all-done' message (and only that message) if the user has completed all tasks in all sets", () => {
        const input = buildInput(dailyTasks.allSets.flatMap(s => s));
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.remainingTasks.length).toBe(1);
        expect(result.remainingTasks[0].taskName).toBe(dailyTasks.allDone);
    });

    it("should handle cases where an experiment has multiple results in a row", () => {
        const inputTasks = dailyTasks.allSets[0].slice(0, 5);
        const input = [];
        inputTasks.forEach(t => { input.push(t); input.push(t) } );
        expect(input.length).toBe(2 * inputTasks.length);
        const result = dailyTasks.getSetAndTasks(buildInput(input));
        expect(result.set).toBe(1);
        const expectedTaskNames = dailyTasks.allSets[result.set - 1].slice(5);
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("should return remaining tasks when the number of characters in the first uncompleted task name is less than or equal to the number of completed tasks", () => {
        let inputTasks = dailyTasks.allSets[0].concat(dailyTasks.allSets[1].slice(0, dailyTasks.allSets[1].length - 1));
        const expectedTaskNames = dailyTasks.allSets[1].slice(dailyTasks.allSets[1].length - 1);
        expect(expectedTaskNames[0].length).toBeLessThanOrEqual(inputTasks.length);
        const input = buildInput(inputTasks);
        const result = dailyTasks.getSetAndTasks(input);
        const remainingTaskNames = result.remainingTasks
            .filter(t => t.taskName !== dailyTasks.doneForToday)
            .map(t => t.taskName);
        expect(remainingTaskNames).toStrictEqual(expectedTaskNames);
    });

    it("should include a 'done-for-today' message after the user finishes the last task for the day", () => {
        const input = buildInput(dailyTasks.allSets[0].slice(0, 2));
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.remainingTasks[result.remainingTasks.length -1].taskName).toBe(dailyTasks.doneForToday);
    });

    it("should include an 'all-done' message when the user finishes the last task of the last set", () => {
        let input = dailyTasks.allSets.flatMap(s => s);
        input = input.slice(0, input.length - 2);
        const result = dailyTasks.getSetAndTasks(buildInput(input));
        expect(result.remainingTasks[result.remainingTasks.length - 1].taskName).toBe(dailyTasks.allDone);
    });
});

describe("taskForName for verbal-fluency", () => {
    it("returns a VerbalFluency object", () => {
        const result = dailyTasks.taskForName("verbal-fluency", { allResults: [{letter: "a"}] } );
        expect(result instanceof VerbalFluency).toBe(true);
    });

    it("throws an error if all possible letters have already been used", () => {
        const input = VerbalFluency.possibleLetters.map(l => { return { letter: l } });
        function callWithAllLetters() {
            dailyTasks.taskForName("verbal-fluency", { allResults: input });
        }
        expect(callWithAllLetters).toThrowError("All of the verbal fluency tasks have been completed.");
    });

    it("returns a VerbalFluency object with a letter that has not been used", () => {
        const input = VerbalFluency.possibleLetters.slice(1).map(l => { return { letter: l } });
        const result = dailyTasks.taskForName("verbal-fluency", { allResults: input });
        expect(result.letter).toBe(VerbalFluency.possibleLetters[0]);
    });

});

describe("taskForName", () => {
    it.skip("throws an error if given the name of an unknown task", () => { // TODO remove skip when we have classes defined for all tasks
        const badTaskName = "jkafkjefij";
        function callWithBadTaskName() {
            dailyTasks.taskForName(badTaskName);
        }
        expect(callWithBadTaskName).toThrowError(`Unknown task type: ${badTaskName}`)
    });
    it("returns a DailyStressors object for daily-stressors", () => {
        const result = dailyTasks.taskForName("daily-stressors", {});
        expect(result instanceof DailyStressors).toBe(true);
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
    it("returns a VerbalLearning object for verbal-learning", () => {
        const result = dailyTasks.taskForName("verbal-learning", {});
        expect(result instanceof VerbalLearning).toBe(true);
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

describe("doing the tasks", () => {
    it("should save the data at the end of each task", () => {
        const saveResultsMock = jest.fn((experimentName, results) => null);
        const allTimelines = dailyTasks.getSetAndTasks([], saveResultsMock);
        jsPsych.init({timeline: allTimelines.remainingTasks});
        // welcome screen
        clickContinue();

        // questionnaire
        const dispElem = jsPsych.getDisplayElement();
        const questions = dispElem.querySelectorAll(".jspsych-survey-likert-options");
        expect(questions.length).toBeGreaterThan(0);
        // each question should have radio buttons; click the first one for each question
        for (let i = 0; i < questions.length; i++) {
            const buttons = questions[i].getElementsByTagName('input');
            expect(buttons.length).toBeGreaterThan(0);
            buttons[0].click();
        }
        clickContinue("input[type=submit]");

        // finished screen
        clickContinue();

        expect(saveResultsMock.mock.calls.length).toBe(2);
        // the experiment name saved to the results should be the name of the first task in allTimelines
        expect(saveResultsMock.mock.calls[1][0]).toBe(allTimelines.remainingTasks[0].taskName);
        // we only care about the relevant result
        let relevantResult = saveResultsMock.mock.calls[1][1].filter(r => r.isRelevant)
        expect(relevantResult.length).toBe(1);
        relevantResult = relevantResult[0];
        expect(relevantResult.response).toBeDefined();
        // the panas task result has a "response" key that's a map of questions -> answers
        expect(Object.keys(relevantResult.response).length).toBe(questions.length);

    });
    it("should save a 'set-finished' result at the end of a set", () => {
        const saveResultsMock = jest.fn((experimentName, results) => null);
        const allTimelines = dailyTasks.getSetAndTasks([], saveResultsMock);
        const tasksToRun = allTimelines.remainingTasks.slice(allTimelines.remainingTasks.length - 2)
        jsPsych.init({timeline: tasksToRun});

        // not-implemented screen TODO replace with correct task completion once task is written
        clickContinue();
        expect(saveResultsMock.mock.calls.length).toBe(2);
        // check experiment name
        expect(saveResultsMock.mock.calls[1][0]).toBe(dailyTasks.setFinished);
        expect(saveResultsMock.mock.calls[1][1]).toStrictEqual([{setNum: 1}]);
    });
    it("should save a 'set-started' result at the start of a set", () => {
        const saveResultsMock = jest.fn((experimentName, results) => null);
        const allTimelines = dailyTasks.getSetAndTasks([], saveResultsMock);
        jsPsych.init({timeline: allTimelines.remainingTasks});
        expect(saveResultsMock.mock.calls.length).toBe(1);
        expect(saveResultsMock.mock.calls[0][0]).toBe(dailyTasks.setStarted);
        expect(saveResultsMock.mock.calls[0][1]).toStrictEqual([{setNum: 1}]);
    });
});

function buildInput(taskList, dateTime = new Date().toISOString()) {
    const input = taskList.map(task => ( {experiment: task} ));
    input.unshift({experiment: dailyTasks.setStarted, dateTime: dateTime});
    return input;
}