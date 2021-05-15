import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-likert.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-survey-likert-patch.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import completion_html from "./frag/completion.html";

const introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["Continue"],
};

const labels = [
    "Very slightly or not at all",
    "A little",
    "Moderately",
    "Quite a bit",
    "Extremely",
];
function question(item) {
    return {
        prompt: item,
        name: item.toLowerCase(),
        labels: labels,
        required: true,
    };
}
const questionnaire = {
    type: "survey-likert",
    preamble: instruction_html,
    questions: [
        "Interested",
        "Distressed",
        "Excited",
        "Upset",
        "Strong",
        "Guilty",
        "Scared",
        "Hostile",
        "Enthusiastic",
        "Proud",
        "Irritable",
        "Alert",
        "Ashamed",
        "Inspired",
        "Nervous",
        "Determined",
        "Attentive",
        "Jittery",
        "Active",
        "Afraid",
    ].map(question),
};

const completion = {
    type: "html-button-response",
    stimulus: completion_html,
    choices: ["Continue"],
};

jsPsych.init({
    timeline: [
        introduction,
        questionnaire,
        completion,
    ],
    on_finish: () => { jsPsych.data.displayData("json"); },
});
