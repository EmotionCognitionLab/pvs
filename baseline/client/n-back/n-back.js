import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "js/jspsych-n-back.js";
import { Random, MersenneTwister19937 } from "random-js";
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
    constructor(setNum, seed = null) {
        this.setNum = setNum;
        if (seed === null) {
            this.random = new Random(MersenneTwister19937.autoSeed());
        } else if (Number.isInteger(seed)) {
            this.random = new Random(MersenneTwister19937.seed(seed));
        } else {
            throw new Error("seed must be null or an integer");
        }
    }

    getTimeline() {
        return [
            this.constructor.introduction,
            this.constructor.instruction(instruction_html),
            this.constructor.instruction(instruction_0_html),
            this.constructor.cue,
            this.randTrial(0),
            this.constructor.rest,
            this.constructor.instruction(instruction_1_html),
            this.constructor.cue,
            this.randTrial(1),
            this.constructor.rest,
            this.constructor.instruction(instruction_2_html),
            this.constructor.cue,
            this.randTrial(2),
            this.constructor.completion,
        ];
    }

    get taskName() {
        return this.constructor.taskName;
    }

    randTrial(n) {
        return {
            type: "n-back",
            n: n,
            sequence: this.randSequence(
                ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
                15,
                n,
                4
            ),
            show_duration: 400,
            hide_duration: 1400,
            data: { isRelevant: true },
        }
    }

    randSequence(choices, length, n, targets) {
        while (true) {
            const sequence = Array(length).fill().map(_ => this.random.pick(choices));
            if (this.constructor.countTargets(n, sequence) === targets) {
                return sequence;
            }
        }
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

NBack.rest = {
    type: "html-keyboard-response",
    stimulus: rest_html,
    choices: jsPsych.NO_KEYS,
    trial_duration: 10000,
};

NBack.countTargets = (n, sequence) => {
    return sequence.filter((item, index) => (
        n === 0 ? item === "1" : item === sequence[index - n]
    )).length;
};


if (window.location.href.includes(NBack.taskName)) {
    jsPsych.init({
        timeline: (new NBack()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
