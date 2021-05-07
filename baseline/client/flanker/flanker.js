import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-preload.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "./style.css";
import arrow_img from "./arrow.png";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import completion_html from "./frag/completion.html";

const preload = {
    type: "preload",
    images: [arrow_img]
}

const introduction = {
    type: "html-keyboard-response",
    stimulus: introduction_html
};

const instruction = {
    type: "html-keyboard-response",
    stimulus: instruction_html
};

function flanker_stimulus(arrows) {
    const head = "<div class=\"arrows\">";
    const body = arrows.map(
        is_right => `<img class=${is_right ? "right" : "left"} src=${arrow_img}>`
    ).join("");
    const tail = "</div><div><em>Press <b>f</b> or <b>j</b>.</em></div>";
    return head + body + tail;
}

function flanker_trial(arrows) {
    return {
        type: "html-keyboard-response",
        stimulus: () => flanker_stimulus(arrows),
        choices: ["f", "j"],
        data: { arrows: arrows }
    };
}

const completion = {
    type: "html-keyboard-response",
    stimulus: completion_html
}

jsPsych.init({
    timeline: [
        preload,
        introduction,
        instruction,
        flanker_trial([1, 1, 1, 1, 1]),
        flanker_trial([0, 0, 0, 0, 0]),
        flanker_trial([1, 1, 0, 1, 1]),
        completion
    ],
    on_finish: () => { jsPsych.data.displayData("json"); }
});
