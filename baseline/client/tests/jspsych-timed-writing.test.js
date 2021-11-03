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

    it("records response text", () => {
        const response = "nice cock"
        jest.useFakeTimers("legacy");
        jsPsych.init({timeline: [{
            type: "timed-writing",
            duration: 1000,
            stimulus: "",
            textarea_rows: 1,
            textarea_cols: 1,
        }]});
        document.getElementById("jspsych-timed-writing-textarea").value = response;
        jest.runAllTimers();
        const data = jsPsych.data.getLastTrialData().values()[0];
        expect(data.response).toBe(response);
    });
});
