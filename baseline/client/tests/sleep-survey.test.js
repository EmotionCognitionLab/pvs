require("@adp-psych/jspsych/jspsych.js");
import { SleepSurvey } from "../sleep-survey/sleep-survey.js";

describe("sleep survey", () => {
    it("results should have two results marked isRelevant", () => {
        const timeline = (new SleepSurvey()).getTimeline();
        expect(timeline.length).toBe(2);
        jsPsych.init({timeline: timeline});

        // questionnaire page 1
        completeSurveyPage();

        // questionnaire page 2
        completeSurveyPage();

        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(2);
    });
});

function completeSurveyPage() {
    const dispElem = jsPsych.getDisplayElement();
    const questions = dispElem.querySelectorAll(".jspsych-survey-likert-options");
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
}
