import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-n-back.js";

describe("jspsych-n-back.js plugin", () => {
    it("loads correctly", () => {
        expect(typeof jsPsych.plugins["n-back"]).toBeDefined();
    });
});
