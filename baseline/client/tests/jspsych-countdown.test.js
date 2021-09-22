import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-countdown.js";

describe("jspsych-countdown.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["countdown"]).toBeDefined();
    });
});

describe("timestamp helper", () => {
    const timestamp = jsPsych.plugins["countdown"].timestamp;

    it("is defined", () => {
        expect(timestamp).toBeDefined;
    });
});
