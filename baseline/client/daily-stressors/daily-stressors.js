import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-multi-choice.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-survey-multi-choice-patch.css";
import "./style.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import completion_html from "./frag/completion.html";

export class DailyStressors {
    getTimeline() {
        return [
            this.constructor.introduction,
            this.constructor.questionnaire,
            this.constructor.completion,
        ];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

DailyStressors.taskName = "daily-stressors";

DailyStressors.introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["Continue"],
};

DailyStressors.prompts = [
    "Did you have an argument or disagreement with anyone since this time yesterday?",
    "Since this time yesterday, did anything happen that you could have argued about but you decided to let pass in order to avoid a disagreement?",
    "Since this time yesterday, did anything else happen in your non-home-related life (e.g., work, school, volunteer, social, etc.) that most people would consider stressful?",
    "Since this time yesterday, did anything else happen in your home life that most people would consider stressful?",
    "Many people experience discrimination on the basis of such things as race, sex, or age. Did anything like this happen to you since this time yesterday?",
    "Since (this time yesterday, did anything happen to a close friend or relative (other than what you have already mentioned) that turned out to be stressful for you?",
    "Did anything else happen to you since (this time/we spoke) yesterday that most people would consider stressful?",
];
DailyStressors.questionnaire = {
    type: "survey-multi-choice",
    preamble: instruction_html,
    questions: DailyStressors.prompts.map(p => ({
        prompt: p,
        options: ["Yes", "No"],
        required: true,
        horizontal: false,
    })),
    data: { isRelevant: true },
};

DailyStressors.completion = {
    type: "html-button-response",
    stimulus: completion_html,
    choices: ["Finish"],
};


if (window.location.href.includes(DailyStressors.taskName)) {
    jsPsych.init({
        timeline: (new DailyStressors()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
