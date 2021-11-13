require("@adp-psych/jspsych/jspsych.js");
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { pressKey } from "./utils.js";

const startAtTimedWriting = letter => {
    jsPsych.init({timeline: (new VerbalFluency(letter)).getTimeline()});
    // instruction screen -> trial
    pressKey(" ");
};

describe("verbal-fluency", () => {
    it("results should have at least one result marked isRelevant", () => {
        jest.useFakeTimers("legacy");  // why legacy: https://github.com/facebook/jest/issues/11500
        startAtTimedWriting("f");
        // timed writing trial
        const inputField = document.querySelector("#jspsych-timed-writing-textarea");
        inputField.value = "fee fi fo fum";
        // let's not wait 60 seconds for the trial to finish
        jest.runAllTimers();
        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });

    it("records letter prompt and user response", () => {
        // prepare letter and response
        const letter = "c";
        const response = "change da world\nmy final message. Goodb ye";
        // run task
        startAtTimedWriting(letter);
        document.querySelector("#jspsych-timed-writing-textarea").value = response;
        jest.runAllTimers();
        // check data
        const data = jsPsych.data.get().filter({isRelevant: true}).values()[0];
        expect(data.letter).toBe(letter);
        expect(data.response).toBe(response);
    });

    it("displays the letter in the stimulus", () => {
        VerbalFluency.possibleLetters.forEach(letter => {
            jest.useFakeTimers("legacy");
            startAtTimedWriting(letter);
            console.log(document.querySelector("#jspsych-timed-writing-stimulus").innerHTML);
            const displayedLetter = document.querySelector("#verbal-fluency-letter").textContent;
            expect(displayedLetter).toBe(letter);
        });
    });

    it("should give the user 60 seconds to generate words", () => {
        // start at timed-writing trial
        jest.useFakeTimers("legacy");
        let finished = false;
        jsPsych.init({
            timeline: (new VerbalFluency(VerbalFluency.possibleLetters[0])).getTimeline(),
            on_finish: () => { finished = true; },
        });
        pressKey(" ");
        // check mocked setTimeout (slightly fragile)
        //expect(setTimeout).toHaveBeenCalledTimes(1);  // display timer code prevents this
        expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 60000);
        // check finished
        expect(finished).toBe(false);  // should not be finished at the start
        jest.advanceTimersByTime(59000);
        expect(finished).toBe(false);  // should not be finished after 59 seconds
        jest.advanceTimersByTime(2000);
        expect(finished).toBe(true);  // should be finished after 61 seconds
    });
});
