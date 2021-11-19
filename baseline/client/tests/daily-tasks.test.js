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
});

describe("taskForName for verbal-fluency", () => {
    it("returns a VerbalFluency object", () => {
        const result = dailyTasks.taskForName("verbal-fluency", { allResults: 
            [
                {experiment: "verbal-fluency", isRelevant: true, results: {letter: "a"}}
            ]}
        );
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
            dailyTasks.taskForName("verbal-fluency", { allResults: input });
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
        jest.useFakeTimers("legacy");
        dailyTasks.runTask(allTimelines.remainingTasks, 0, saveResultsMock);
        // full-screen mode screen
        clickContinue();
        jest.runAllTimers();
        
        // questionnaire
        const dispElem = jsPsych.getDisplayElement();
        const questions = dispElem.querySelectorAll(".jspsych-percent-sum-field");
        expect(questions.length).toBe(3);
        // each question needs a number input; the three should sum to 100
        questions[0].value = 33;
        questions[1].value = 33;
        questions[2].value = 34;
        //trigger input event to get the jspsych-percent-sum plugin to activate the submit button
        questions[0].dispatchEvent(new InputEvent("input"));
        clickContinue("input[type=submit]");

        expect(saveResultsMock.mock.calls.length).toBe(6); // set-started, task-started, full-screen, results, user-agent, next task started
        // the experiment name saved to the results should be the name of the first task in allTimelines
        expect(saveResultsMock.mock.calls[3][0]).toBe(allTimelines.remainingTasks[0].taskName);
        // it should save the browser user agent as part of the results
        const ua = saveResultsMock.mock.calls[4][1].filter(r => r.ua);
        expect(ua.length).toBe(1);
        expect(ua[0].ua).toBe(window.navigator.userAgent);
        // we only care about the relevant result
        let relevantResult = saveResultsMock.mock.calls[3][1].filter(r => r.isRelevant);
        expect(relevantResult.length).toBe(1);
        relevantResult = relevantResult[0];
        expect(relevantResult.response).toBeDefined();
        // the panas task result has a "response" key that's a map of questions -> answers
        expect(Object.keys(relevantResult.response).length).toBe(questions.length);

    });
    it("should save a 'set-finished' result at the end of a set", () => {
        const tasksToRun = allTimelines.remainingTasks.slice(allTimelines.remainingTasks.length - 2);
        jest.useFakeTimers("legacy");
        dailyTasks.runTask(tasksToRun, 0, saveResultsMock);

        // full-screen mode screen
        clickContinue();
        jest.runAllTimers();
        // spatial-orientation
        for (let i = 1; i < tasksToRun[0].timeline.length; i++) {
            const task = tasksToRun[0].timeline[i];
            if (task.type === "html-keyboard-response") {
                pressKey(" ");
            } else if (task.type === "spatial-orientation") {
                clickIcirc(document.getElementById("jspsych-spatial-orientation-icirc"), 0, 0);
                jest.advanceTimersByTime(task.lingerDuration);
            }
        }
        expect(saveResultsMock.mock.calls.length).toBe(25);
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
        expect(saveResultsMock.mock.calls[1][1]).toStrictEqual([{"taskStarted": true}]);
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
