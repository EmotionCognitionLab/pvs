require("@adp-psych/jspsych/jspsych.js");
import { DailyStressors } from "../daily-stressors/daily-stressors.js";

describe("daily-stressors", () => {
    it("results should have at least one result marked isRelevant", () => {
        const timeline = (new DailyStressors()).getTimeline();
        expect(timeline.length).toBe(1);
        jsPsych.init({timeline: timeline});

        // questionnaire
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
