require("@adp-psych/jspsych/jspsych.js");
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { MoodPrediction } from "../mood-prediction/mood-prediction.js";

// Because mood-memory and mood-prediction are identical aside
// from the text presented to the user we can test them both 
// with the same code.

function completeMoodQuestionnaire(timeline) {
    jsPsych.init({timeline: timeline});

    // questionnaire
    const dispElem = jsPsych.getDisplayElement();
    const moodStates = dispElem.querySelectorAll(".jspsych-percent-sum-field");
    expect(moodStates.length).toBeGreaterThan(0);
    // each mood state field should be a number input with default value 0
    // the combined sum has to be 100
    moodStates[0].value = 100;
    //trigger input event to get the jspsych-percent-sum plugin to activate the submit button
    moodStates[0].dispatchEvent(new InputEvent("input"));
    
    const submitButton = dispElem.querySelector("input[type=submit]");
    expect(submitButton).not.toBe(null);
    submitButton.click();
}


describe("mood-memory", () => {
    it("results should have at least one result marked isRelevant", () => {
        const timeline = (new MoodMemory()).getTimeline();
        expect(timeline.length).toBe(1);
        completeMoodQuestionnaire(timeline);
        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });
});

describe("mood-prediction", () => {
    it("results should have at least one result marked isRelevant", () => {
        const timeline = (new MoodPrediction()).getTimeline();
        expect(timeline.length).toBe(1);
        completeMoodQuestionnaire(timeline);
        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });
});