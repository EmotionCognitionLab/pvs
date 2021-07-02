require("@adp-psych/jspsych/jspsych.js");
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { pressKey } from "./utils.js"

jest.useFakeTimers();

describe("verbal-fluency", () => {
    it("results should have at least one result marked isRelevant", () => {
        let timeline = (new VerbalFluency()).getTimeline();
        expect(timeline.length).toBe(4);
        jsPsych.init({timeline: timeline});

        // welcome screen -> instruction
        pressKey(" ");
        // instruction screen -> trial
        pressKey(" ");
        // first trial
        const inputField = document.querySelector("#jspsych-timed-writing-textarea");
        inputField.value = "fee fi fo fum";
        // let's not wait 60 seconds for the trial to finish
        jest.runAllTimers();
        // completion
        pressKey(" ");


        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });
});