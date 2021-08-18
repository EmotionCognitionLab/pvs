import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-spatial-orientation.js";

describe("jspsych-spatial-orientation.js plugin", () => {
    it("loads correctly", () => {
        expect(typeof jsPsych.plugins["spatial-orientation"]).toBeDefined;
    });
});
