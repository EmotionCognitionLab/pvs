import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-timed-writing.js";

describe("jspsych-timed-writing.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["timed-writing"]).toBeDefined();
    });

    it("shows stimulus", () => {
        const stimulus = "trust rock";
        jsPsych.init({timeline: [{
            type: "timed-writing",
            duration: 1000,
            stimulus: stimulus,
            textarea_rows: 1,
            textarea_cols: 1,
        }]});
        expect(jsPsych.getDisplayElement().innerHTML).toContain(stimulus);
    });
});
