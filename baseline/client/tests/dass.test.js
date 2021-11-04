require("@adp-psych/jspsych/jspsych.js");
import { Dass } from "../dass/dass.js";

describe("DASS", () => {
    it("should require all quuestions to be completed", () => {
        const tl = (new Dass()).getTimeline();
        expect(tl).toHaveLength(1);
        expect(tl[0].questions.length).toBeGreaterThan(1);
        for (let q of tl[0].questions) {
            expect(q.required).toBe(true);
        }
    });

    it("should have at least one result marked isRelevant", () => {
        jsPsych.init({timeline: (new Dass()).getTimeline()});
        const dispElem = jsPsych.getDisplayElement();
        const questions = dispElem.querySelectorAll(".jspsych-survey-multi-choice-question");
        expect(questions.length).toBeGreaterThan(0);
        // each question should have radio buttons; click the first one for each question
        for (let i = 0; i < questions.length; i++) {
            const buttons = questions[i].getElementsByTagName('input');
            expect(buttons.length).toBeGreaterThan(0);
            buttons[0].click();
        }
        const submitButton = dispElem.querySelector("input[type=submit]");
        expect(submitButton).not.toBe(null);
        submitButton.click();

        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });

});
