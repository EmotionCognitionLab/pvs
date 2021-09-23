import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-multi-choice.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-survey-multi-choice-patch.css";
import "./style.css";
import instruction_html from "./frag/instruction.html";

export class DailyStressors {
    getTimeline() {
        return [
            this.constructor.questionnaire,
        ];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

DailyStressors.taskName = "daily-stressors";

DailyStressors.binaryPrompts = [
    "Did you have an argument or disagreement with anyone since this time yesterday?",
    "Since this time yesterday, did anything happen that you could have argued about but you decided to let pass in order to avoid a disagreement?",
    "Since this time yesterday, did anything else happen in your non-home-related life (e.g., work, school, volunteer, social, etc.) that most people would consider stressful?",
    "Since this time yesterday, did anything else happen in your home life that most people would consider stressful?",
    "Many people experience discrimination on the basis of such things as race, sex, or age. Did anything like this happen to you since this time yesterday?",
    "Since this time yesterday, did anything happen to a close friend or relative (other than what you have already mentioned) that turned out to be stressful for you?",
    "Did anything else happen to you since this time yesterday that most people would consider stressful?",
];
DailyStressors.questionnaire = {
    type: "survey-multi-choice",
    preamble: instruction_html,
    questions: [
        {
            prompt: "What do you feel your stress level is today on a scale from 1 to 9 (1 = very low, 5 = moderate, 9 = very high)?",
            options: [...Array(9).keys()].map(i => String(i+1)),
            required: true,
            horizontal: true,
        },
        ...DailyStressors.binaryPrompts.map(p => ({
            prompt: p,
            options: ["Yes", "No"],
            required: true,
            horizontal: false,
        })),
    ],
    data: { isRelevant: true },
};

if (window.location.href.includes(DailyStressors.taskName)) {
    jsPsych.init({
        timeline: (new DailyStressors()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
