import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-n-back.js";
import { pressKey } from "./utils.js"

const pressBubblingKey = key => {
    const initDict = {key: key, bubbles: true};
    const display = document.querySelector(".jspsych-display-element");
    display.dispatchEvent(new KeyboardEvent("keydown", initDict));
    display.dispatchEvent(new KeyboardEvent("keyup", initDict));
};

describe("jspsych-n-back.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["n-back"]).toBeDefined();
    });

    it("finds missed indices correctly", () => {
        const testSettings = n => ({timeline: [{
            type: "n-back",
            n: n,
            sequence: [0, 0, 1, 1, 0, 1, 0].map(String),
            show_duration: 1000,
            hide_duration: 0,
        }]});
        const getLastTrialData = () => jsPsych.data.getLastTrialData().values()[0];
        jest.useFakeTimers("legacy");
        // all missed
        jsPsych.init(testSettings(0));
        jest.runAllTimers();
        expect(getLastTrialData().missedIndices).toStrictEqual([2, 3, 5]);
        // none missed
        jsPsych.init(testSettings(1));
        jest.advanceTimersByTime(1000);
        pressBubblingKey(" ");
        jest.advanceTimersByTime(2000);
        pressBubblingKey(" ");
        jest.runAllTimers();
        expect(getLastTrialData().missedIndices).toStrictEqual([]);
        // one missed
        jsPsych.init(testSettings(2));
        jest.advanceTimersByTime(5000);
        pressBubblingKey(" ");
        jest.runAllTimers();
        expect(getLastTrialData().missedIndices).toStrictEqual([6]);
    });
});
