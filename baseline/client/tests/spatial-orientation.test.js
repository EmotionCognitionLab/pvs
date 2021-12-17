import { SpatialOrientation } from "../spatial-orientation/spatial-orientation.js";
import { pressKey, clickIcirc } from "./utils.js";
import "jest-canvas-mock";

const originalDateNow = Date.now;  // original    Starwalker
const resetDateNow = () => { Date.now = originalDateNow; };
afterEach(resetDateNow);

const advanceDateNowThenTimers = ms => {
    Date.now = (f => () => f() + ms)(Date.now);
    jest.advanceTimersByTime(ms);
};

describe("spatial-orientation", () => {
    it("results should have at least one result marked isRelevant", () => {
        jest.useFakeTimers("legacy");
        const timeline = (new SpatialOrientation(1)).getTimeline();
        jsPsych.init({timeline: timeline});
        timeline.forEach(() => {
            pressKey(" ");
            const icirc = document.getElementById("jspsych-spatial-orientation-icirc");
            if (icirc !== null) {
                clickIcirc(icirc, 0, 0);
            }
            jest.runAllTimers();
        });
        const progress = jsPsych.progress();
        expect(progress.current_trial_global).toBe(progress.total_trials);
        expect(jsPsych.data.get().filter({isRelevant: true}).values().length).toBeGreaterThan(0);
    });

    it("completes test trials with timedout and skipped if 5 minutes have elapsed", () => {
        jest.useFakeTimers("legacy");
        // skip timeline to test block
        const timeline = (new SpatialOrientation(1)).getTimeline();
        jsPsych.init({timeline: timeline});
        // actively progress trials until first test spatial-orientation trial is encountered
        for (const trial of timeline) {
            if (trial.data?.isRelevant === true) {
                break;
            } else if (trial.type === "html-keyboard-response") {
                pressKey(" ");
            } else if (trial.type === "spatial-orientation") {
                clickIcirc(document.getElementById("jspsych-spatial-orientation-icirc"), 0, 0);
                advanceDateNowThenTimers(trial.lingerDuration);
            }
        }
        // expect test trials to NOT be completed at first
        expect(jsPsych.data.get().filter({isRelevant: true}).values().length).toBe(0);
        // expect test trials to still NOT be completed after 4 minutes and 55 seconds
        advanceDateNowThenTimers(4*60*1000 + 55*1000);  // 4 minutes and 55 seconds
        expect(jsPsych.data.get().filter({isRelevant: true}).values().length).toBe(0);
        // expect test trials to be completed after 5 minutes and 5 seconds
        advanceDateNowThenTimers(10*1000);  // 10 seconds more
        const relevant = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevant.length).toBe(12);
        expect(relevant[0].completionReason).toBe("timedout");
        relevant.slice(1).forEach(t => {
             expect(t.completionReason).toBe("skipped");
        });
    });

    it("can be finished without exceeding the time limit", () => {
        const timeline = (new SpatialOrientation(1)).getTimeline();
        jest.useFakeTimers("legacy");
        let finished = false;
        jsPsych.init({
            timeline: timeline,
            on_finish: () => { finished = true; },
        });
        // finish all trials as fast as possible (only waiting for the lingerDuration after each trial)
        for (const trial of timeline) {
            if (trial.type === "html-keyboard-response") {
                pressKey(" ");
            } else if (trial.type === "spatial-orientation") {
                clickIcirc(document.getElementById("jspsych-spatial-orientation-icirc"), 0, 0);
                advanceDateNowThenTimers(trial.lingerDuration);
            }
        }
        // task should be finished
        expect(finished).toBe(true);
        const sotTrials = jsPsych.data.get().filter({trial_type: "spatial-orientation"}).values();
        // no trials should have been timedout or skipped
        expect(sotTrials.every(t => t.completionReason === "responded")).toBe(true);
    });

    it("has 12 relevant test trials per set", () => {
        for (let i = 1; i <= 12; ++i) {
            const timeline = (new SpatialOrientation(i)).getTimeline();
            const sots = timeline.filter(trial => trial.data?.isRelevant);
            expect(sots.length).toBe(12);
            expect(sots.every(trial => trial.mode === "test")).toBe(true);
        }
    });

    it("includes example and practice blocks only in the first set", () => {
        {
            const timeline1 = (new SpatialOrientation(1)).getTimeline();
            const sots1 = timeline1.filter(trial => trial.type === "spatial-orientation");
            expect(sots1.slice(0, 1).every(trial => trial.mode === "example")).toBe(true);
            expect(sots1.slice(1, 4).every(trial => trial.mode === "practice")).toBe(true);
            expect(sots1.slice(4).every(trial => trial.mode === "test")).toBe(true);
        }
        for (let i = 2; i <= 12; ++i) {
            const timelineI = (new SpatialOrientation(i)).getTimeline();
            const sotsI = timelineI.filter(trial => trial.type === "spatial-orientation");
            // all trials should be test trials
            expect(sotsI.every(trial => trial.mode === "test")).toBe(true);
        }
    });

    it("has well-formed stimuli", () => {
        const validateTrial = trial => {
            const objectNames = [trial.center, trial.facing, trial.target];
            // each object should be distinct from each other object
            expect((new Set(objectNames)).size).toBe(3);
            // each object should have a defined position
            objectNames.forEach(name => {
                expect(SpatialOrientation.scenePositions[name]).toBeDefined();
            });
        };
        const allTrials = [
            ...SpatialOrientation.stimulus.example.trials,
            ...SpatialOrientation.stimulus.practice.trials,
            ...Object.values(SpatialOrientation.stimulus["test-sets"]).flatMap(set => set.trials),
        ];
        allTrials.forEach(validateTrial);
    });
});
