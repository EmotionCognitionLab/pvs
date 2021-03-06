import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-n-back.js";
import { pressKey } from "./utils.js";

const getLastTrialData = () => jsPsych.data.getLastTrialData().values()[0];

describe("jspsych-n-back.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["n-back"]).toBeDefined();
    });

    it("records responses correctly", () => {
        const trial = {
            type: "n-back",
            n: 0,
            sequence: [0, 1, 0, 1].map(String),
            show_duration: 1000,
            hide_duration: 0,
        };
        const presses = [10, 0, 30, 20];
        // start timeline and simulate keypresses
        jest.useFakeTimers("legacy");
        jsPsych.init({timeline: [trial]});
        presses.forEach(n => {
            for (let i = 0; i < n; ++i) {
                pressKey(" ", true);
            }
            jest.advanceTimersByTime(trial.show_duration);
        });
        const data = getLastTrialData();
        // the number of responses recorded should be the number of keypresses
        expect(data.responses.length).toBe(presses.reduce((a, b) => a + b, 0));
        // the number of responses and keypresses should be the same for each index
        trial.sequence.forEach((_, index) => {
            expect(data.responses.filter(r => r.index === index).length).toBe(presses[index]);
        });
        // only responses to targets are marked as correct
        data.responses.forEach(r => {
            expect(r.correct).toBe(r.index === 1 || r.index === 3);
        });
        // to-do: test time_from_start and time_from_focus by mocking performance.now
    });

    it("finds missed indices correctly", () => {
        const testSettings = n => ({timeline: [{
            type: "n-back",
            n: n,
            sequence: [0, 0, 1, 1, 0, 1, 0].map(String),
            show_duration: 1000,
            hide_duration: 0,
        }]});
        jest.useFakeTimers("legacy");
        // all missed
        jsPsych.init(testSettings(0));
        jest.runAllTimers();
        expect(getLastTrialData().missedIndices).toStrictEqual([2, 3, 5]);
        // none missed
        jsPsych.init(testSettings(1));
        jest.advanceTimersByTime(1000);
        pressKey(" ", true);
        jest.advanceTimersByTime(2000);
        pressKey(" ", true);
        jest.runAllTimers();
        expect(getLastTrialData().missedIndices).toStrictEqual([]);
        // one missed
        jsPsych.init(testSettings(2));
        jest.advanceTimersByTime(5000);
        pressKey(" ", true);
        jest.runAllTimers();
        expect(getLastTrialData().missedIndices).toStrictEqual([6]);
    });
});
