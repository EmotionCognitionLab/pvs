import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-preload.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-audio-keyboard-response.js";
import "js/jspsych-memory-field.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-memory-field.css";
import "css/common.css";
import "./style.css";
// audio
import a_audio from "./a.wav";
import b_audio from "./b.wav";
// fragments
import introduction_html from "./frag/introduction.html";
import instruction_a_immediate_html from "./frag/instruction_a_immediate.html";
import instruction_a_immediate_rep_html from "./frag/instruction_a_immediate_rep.html";
import instruction_b_immediate_html from "./frag/instruction_b_immediate.html";
import instruction_a_short_html from "./frag/instruction_a_short.html";
import instruction_a_cue_furniture_html from "./frag/instruction_a_cue_furniture.html";
import instruction_a_cue_vegetable_html from "./frag/instruction_a_cue_vegetable.html";
import instruction_a_cue_traveling_html from "./frag/instruction_a_cue_traveling.html";
import instruction_a_cue_animal_html from "./frag/instruction_a_cue_animal.html";
import instruction_a_long_html from "./frag/instruction_a_long.html";
import completion_html from "./frag/completion.html";

const preload = {
    type: "preload",
    audio: [a_audio, b_audio],
};

const introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["Continue"],
};

const instruction = stimulus => ({
    type: "html-button-response",
    stimulus: stimulus,
    choices: ["Start"],
});

const presentation = audio_stimulus => ({
    type: "audio-keyboard-response",
    stimulus: audio_stimulus,
    prompt: "...",
    choices: jsPsych.NO_KEYS,
    trial_ends_after_audio: true,
});

const remember = {
    type: "memory-field",
    stimulus: "",
    button_label: "Stop",
};

const completion = {
    type: "html-button-response",
    stimulus: completion_html,
    choices: ["Finish"],
};

jsPsych.init({
    timeline: [
        preload,
        introduction,
        instruction(instruction_a_immediate_html),  // 1
        presentation(a_audio),
        remember,
        instruction(instruction_a_immediate_rep_html),  // 2
        presentation(a_audio),
        remember,
        instruction(instruction_a_immediate_rep_html),  // 3
        presentation(a_audio),
        remember,
        instruction(instruction_a_immediate_rep_html),  // 4
        presentation(a_audio),
        remember,
        instruction(instruction_a_immediate_rep_html),  // 5
        presentation(a_audio),
        remember,
        instruction(instruction_b_immediate_html),
        presentation(b_audio),
        remember,
        instruction(instruction_a_short_html),
        remember,
        instruction(instruction_a_cue_furniture_html),
        remember,
        instruction(instruction_a_cue_vegetable_html),
        remember,
        instruction(instruction_a_cue_traveling_html),
        remember,
        instruction(instruction_a_cue_animal_html),
        remember,
        instruction(instruction_a_long_html),
        remember,
        instruction(instruction_a_cue_furniture_html),
        remember,
        instruction(instruction_a_cue_vegetable_html),
        remember,
        instruction(instruction_a_cue_traveling_html),
        remember,
        instruction(instruction_a_cue_animal_html),
        remember,
        completion,
    ],
    on_finish: () => { jsPsych.data.displayData("json"); },
});
