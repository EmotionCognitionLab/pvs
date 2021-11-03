import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-memory-field.js";

describe("jspsych-memory-field.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["memory-field"]).toBeDefined();
    });
});
