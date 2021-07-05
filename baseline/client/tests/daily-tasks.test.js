'use strict';

import { DailyStressors } from "../daily-stressors/daily-stressors.js";
import { Flanker } from "../flanker/flanker.js";
import * as dailyTasks from "../daily-tasks/daily-tasks.js";
import { MoodPrediction  } from "../mood-prediction/mood-prediction.js";
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { Panas } from "../panas/panas.js";
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";

describe("getSetAndTasks", () => {
    it("returns the set and remaining tasks in the set", () => {
        const input = [{experiment: dailyTasks.allSets[0][0]}, {experiment: dailyTasks.allSets[0][1]}];
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(1);
        expect(result.remainingTasks).toStrictEqual(dailyTasks.allSets[0].slice(input.length));
    });

    it("returns the next set and all tasks in it if all tasks in the previous set have been ccompleted", () => {
        const input = dailyTasks.allSets[0].map(name => { return { experiment: name } });
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(2);
        expect(result.remainingTasks).toStrictEqual(dailyTasks.allSets[result.set - 1]);
    });

    it("throws an error if completed tasks are not in the expected order", () => {
        const input = [{experiment: dailyTasks.allSets[0][0]}, {experiment: dailyTasks.allSets[0][2]}];
        function callWithBadOrder() {
            dailyTasks.getSetAndTasks(input);
        }
        const expectedErrPatt = new RegExp(`^Expected ${dailyTasks.allSets[0][1]} but found ${dailyTasks.allSets[0][2]}.*$`);
        expect(callWithBadOrder).toThrowError(expectedErrPatt);
    });

    it("should return no tasks if all sets and all tasks have been completed", () => {
        const input = [];
        dailyTasks.allSets.forEach(s => {
            s.forEach(task => {
                input.push({experiment: task});
            });
        });
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(dailyTasks.allSets.length);
        expect(result.remainingTasks).toStrictEqual([]);
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
    it("throws an error if given the name of an unknown task", () => {
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
    it("returns a Flanker with four practice trials for the first set but not for other sets", () => {
        const set1Result = dailyTasks.taskForName("flanker", {setNum: 1});
        const set2Result = dailyTasks.taskForName("flanker", {setNum: 2});
        const timelineDiff = set1Result.getTimeline().length - set2Result.getTimeline().length;
        expect(timelineDiff).toBe(4);
    });
    it("defaults to set 1 if no set number is provided", () => {
        const set1Result = dailyTasks.taskForName("flanker", {setNum: 1});
        const noSetResult = dailyTasks.taskForName("flanker", {});
        expect(noSetResult.getTimeline()).toStrictEqual(set1Result.getTimeline());
    });
});
