import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "js/jspsych-n-back.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-n-back.css";
import "./style.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import instruction_0_html from "./frag/instruction_0.html";
import instruction_1_html from "./frag/instruction_1.html";
import instruction_2_html from "./frag/instruction_2.html";
import rest_html from "./frag/rest.html";
import completion_html from "./frag/completion.html";

export class NBack {
    getTimeline() {
        return [
            this.constructor.introduction,
            this.constructor.instruction(instruction_html),
            this.constructor.instruction(instruction_0_html),
            this.constructor.cue,
            this.constructor.trial(0, ["5", "6", "3", "6", "1", "7", "7"]),
            this.constructor.rest,
            this.constructor.instruction(instruction_1_html),
            this.constructor.cue,
            this.constructor.trial(1, ["5", "6", "3", "6", "1", "7", "7"]),
            this.constructor.rest,
            this.constructor.instruction(instruction_2_html),
            this.constructor.cue,
            this.constructor.trial(2, ["5", "6", "3", "6", "1", "7", "7"]),
            this.constructor.completion,
        ];
    }
}

NBack.taskName = "n-back";

NBack.introduction = {
    type: "html-keyboard-response",
    stimulus: introduction_html,
    choices: [" "],
};

NBack.instruction = stimulus => ({
    type: "html-keyboard-response",
    stimulus: stimulus,
    choices: [" "],
});

NBack.completion = {
    type: "html-keyboard-response",
    stimulus: completion_html,
    choices: [" "],
};

NBack.cue = {
    type: "html-keyboard-response",
    stimulus: `<div class="jspsych-n-back-item jspsych-n-back-item-focused">+</div>`,
    choices: jsPsych.NO_KEYS,
    trial_duration: 2000,
};

NBack.trial = (n, sequence) => ({
    type: "n-back",
    n: n,
    sequence: sequence,
    show_duration: 400,
    hide_duration: 1400,
    data: { isRelevant: true },
});

NBack.rest = {
    type: "html-keyboard-response",
    stimulus: rest_html,
    choices: jsPsych.NO_KEYS,
    trial_duration: 10000,
};


if (window.location.href.includes(NBack.taskName)) {
    jsPsych.init({
        timeline: (new NBack()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
