import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-n-back.js";

describe("jspsych-n-back.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["n-back"]).toBeDefined();
    });

    it("finds missed indices correctly", () => {
        jest.useFakeTimers("legacy");
        jsPsych.init({timeline: [{
            type: "n-back",
            n: 0,
            sequence: [0, 0, 1, 1, 0, 1].map(String),
            show_duration: 0,
            hide_duration: 0,
        }]});
        jest.runAllTimers();
        const data = jsPsych.data.getLastTrialData().values()[0];
        expect(data.missedIndices).toStrictEqual([2, 3, 5]);
    });
});
