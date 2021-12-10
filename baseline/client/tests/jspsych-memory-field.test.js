import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-memory-field.js";

describe("jspsych-memory-field.js plugin", () => {
    global.confirm = () => true; // stub window.confirm

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
        const initDict = {key: "Enter"};
        responses.forEach(r => {
            field.value = r;
            field.dispatchEvent(new KeyboardEvent("keydown", initDict));
            field.dispatchEvent(new KeyboardEvent("keyup", initDict));
        });
        document.getElementById("jspsych-memory-field-button").click();
        const data = jsPsych.data.getLastTrialData().values()[0];
        expect(data.response).toStrictEqual(responses);
    });

    it("records lingering response in input field", () => {
        const response = "my enter key is broken";
        jsPsych.init({timeline: [{
            type: "memory-field",
            stimulus: "",
            button_label: "",
        }]});
        document.getElementById("jspsych-memory-field-field").value = response;
        document.getElementById("jspsych-memory-field-button").click();
        const data = jsPsych.data.getLastTrialData().values()[0];
        expect(data.response).toStrictEqual([response]);
    });

    it("records nothing for no response in input field", () => {
        jsPsych.init({timeline: [{
            type: "memory-field",
            stimulus: "",
            button_label: "",
        }]});
        document.getElementById("jspsych-memory-field-button").click();
        const data = jsPsych.data.getLastTrialData().values()[0];
        expect(data.response).toStrictEqual([]);
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

    it("prompts to make sure user is finished when button is pressed", () => {
        global.confirm = jest.fn(() => true);
        expect(global.confirm.mock.calls.length).toBe(0);
        jsPsych.init({
            timeline: [{
                type: "memory-field",
                stimulus: "",
                button_label: "",
            }]
        });
        document.getElementById("jspsych-memory-field-button").click();
        expect(global.confirm.mock.calls.length).toBe(1);
    });

    it("does not finish the trial if the user says they're not done after pressing the button", () => {
        global.confirm = jest.fn(() => false);
        expect(global.confirm.mock.calls.length).toBe(0);
        let finished = false;
        jsPsych.init({
            timeline: [{
                type: "memory-field",
                stimulus: "",
                button_label: "",
            }],
            on_finish: () => { finished = true; }
        });
        document.getElementById("jspsych-memory-field-button").click();
        expect(global.confirm.mock.calls.length).toBe(1);
        expect(finished).toBe(false);
    });

    it("disables autocomplete", () => {
        jsPsych.init({timeline: [{
            type: "memory-field",
            stimulus: "",
            button_label: "",
        }]});
        expect(document.getElementById("jspsych-memory-field-field").autocomplete).toBe("off");
    });
});
