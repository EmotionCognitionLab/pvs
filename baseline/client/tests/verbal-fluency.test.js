require("@adp-psych/jspsych/jspsych.js");
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { pressKey } from "./utils.js";

jest.useFakeTimers('legacy'); // why legacy: https://github.com/facebook/jest/issues/11500

beforeEach(() => {
    let timeline = (new VerbalFluency()).getTimeline();
    expect(timeline.length).toBe(2);
    jsPsych.init({timeline: timeline});
    // instruction screen -> trial
    pressKey(" ");
});

describe("verbal-fluency", () => {
    it("results should have at least one result marked isRelevant", () => {
        // first trial
        const inputField = document.querySelector("#jspsych-timed-writing-textarea");
        inputField.value = "fee fi fo fum";
        // let's not wait 60 seconds for the trial to finish
        jest.runAllTimers();
        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });

    it("should give the user 60 seconds to generate words", () => {
        //expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 60000);
    });
});