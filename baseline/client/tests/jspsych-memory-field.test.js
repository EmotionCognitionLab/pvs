import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-memory-field.js";
import { pressKey } from "./utils.js"

describe("jspsych-memory-field.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["memory-field"]).toBeDefined();
    });

    it("shows stimulus", () => {
        const stimulus = "were you just frying chicken in there?";
        const buttonLabel = "i think that's pretty cool";
        jsPsych.init({timeline: [{
            type: "memory-field",
            stimulus: stimulus,
            button_label: buttonLabel,
        }]});
        expect(jsPsych.getDisplayElement().innerHTML).toContain(stimulus);
        expect(jsPsych.getDisplayElement().innerHTML).toContain(buttonLabel);
    });

    it("records entered responses", () => {
        const responses = ["spaghetti", "and", "meatballs"];
        jsPsych.init({timeline: [{
            type: "memory-field",
            stimulus: "",
            button_label: "",
        }]});
        const field = document.getElementById("jspsych-memory-field-field");
        const initDict = {key: "Enter"}
        responses.forEach(r => {
            field.value = r;
            field.dispatchEvent(new KeyboardEvent("keydown", initDict));
            field.dispatchEvent(new KeyboardEvent("keyup", initDict));
        });
        document.getElementById("jspsych-memory-field-button").click();
        const data = jsPsych.data.getLastTrialData().values()[0];
        expect(data.response).toStrictEqual(responses);
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
