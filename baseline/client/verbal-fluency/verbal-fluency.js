import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "js/jspsych-timed-writing.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-timed-writing.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import stimulus_template_html from "./frag/stimulus-template.html";
import completion_html from "./frag/completion.html";

const introduction = {
    type: "html-keyboard-response",
    stimulus: introduction_html,
    choices: [" "],
};

const instruction = {
    type: "html-keyboard-response",
    stimulus: instruction_html,
    choices: [" "],
};

function trial(letter) {
    return {
        type: "timed-writing",
        duration: 60000,
        stimulus: stimulus_template_html.replace("{letter}", letter),
        textarea_rows: 6,
        textarea_cols: 60,
        data: { letter: letter },
    };
}

const completion = {
    type: "html-keyboard-response",
    stimulus: completion_html,
    choices: [" "],
};

jsPsych.init({
    timeline: [
        introduction,
        instruction,
        trial("u"),
        completion,
    ],
    on_finish: () => { jsPsych.data.displayData("json"); },
});
