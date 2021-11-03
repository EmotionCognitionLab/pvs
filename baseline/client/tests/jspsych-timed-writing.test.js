import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-timed-writing.js";

describe("jspsych-timed-writing.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["timed-writing"]).toBeDefined();
    });
});
