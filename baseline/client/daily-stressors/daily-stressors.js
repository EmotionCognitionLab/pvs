import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-multi-choice.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "./style.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import completion_html from "./frag/completion.html";

const introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["Continue"],
};

const prompts = [
    "Did you have an argument or disagreement with anyone since this time yesterday?",
    "Since this time yesterday, did anything happen that you could have argued about but you decided to let pass in order to avoid a disagreement?",
    "Since this time yesterday, did anything happen at work or school (other than what you have already mentioned) that most people would consider stressful?",
    "Since this time yesterday, did anything happen at home (other than what you have already mentioned) that most people would consider stressful?",
    "Many people experience discrimination on the basis of such things as race, sex, or age. Did anything like this happen to you since this time yesterday?",
    "Since (this time yesterday, did anything happen to a close friend or relative (other than what you have already mentioned) that turned out to be stressful for you?",
    "Did anything else happen to you since (this time/we spoke) yesterday that most people would consider stressful?",
];
const questionnaire = {
    type: "survey-multi-choice",
    preamble: instruction_html,
    questions: prompts.map(
        p => ({ prompt: p, options: ["Yes", "No"], requried: true, horizontal: true })
    ),
};

const completion = {
    type: "html-button-response",
    stimulus: completion_html,
    choices: ["Finish"],
};

jsPsych.init({
    timeline: [
        introduction,
        questionnaire,
        completion,
    ],
    on_finish: () => { jsPsych.data.displayData("json"); },
});
