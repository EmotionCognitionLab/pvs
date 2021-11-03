import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-memory-field.js";

describe("jspsych-memory-field.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["memory-field"]).toBeDefined();
    });

    it("shows stimulus", () => {
        const stimulus = "const stimulus";
        const buttonLabel = "const buttonLabel";
        jsPsych.init({timeline: [{
            type: "memory-field",
            stimulus: stimulus,
            button_label: buttonLabel,
        }]});
        expect(jsPsych.getDisplayElement().innerHTML).toContain(stimulus);
        expect(jsPsych.getDisplayElement().innerHTML).toContain(buttonLabel);
    });

    it("finishes when button is pressed", () => {
        let finished = false;
        jsPsych.init({
            timeline: [{
                type: "memory-field",
                stimulus: "",
                button_label: "",
            }],
            on_finish: () => { finished = true; }
        });
        expect(finished).toBe(false);
        document.getElementById("jspsych-memory-field-button").click();
        expect(finished).toBe(true);
    });
});
