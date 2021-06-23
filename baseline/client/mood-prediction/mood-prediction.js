import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "js/jspsych-percent-sum.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "css/jspsych-percent-sum.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import completion_html from "./frag/completion.html";

const introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["Continue"],
};

const questionnaire = {
    type: "percent-sum",
    preamble: instruction_html,
    fields: ["Good Mood", "Bad Mood", "Neutral Mood"],
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
