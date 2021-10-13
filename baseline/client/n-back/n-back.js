import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "js/jspsych-n-back.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-n-back.css";
import "css/common.css";
import "./style.css";
// cue fragments
import cue_0_html from "./frag/cue_0.html";
import cue_1_html from "./frag/cue_1.html";
import cue_2_html from "./frag/cue_2.html";
// rest fragment
import rest_html from "./frag/rest.html";
// training fragments
import train_introduction_html from "./frag/train/introduction.html";
import train_instruction_start_html from "./frag/train/instruction_start.html";
import train_instruction_0a_html from "./frag/train/instruction_0a.html";
import train_instruction_0b_html from "./frag/train/instruction_0b.html";
import train_instruction_1a_html from "./frag/train/instruction_1a.html";
import train_instruction_1b_html from "./frag/train/instruction_1b.html";
import train_instruction_2a_html from "./frag/train/instruction_2a.html";
import train_instruction_2b_html from "./frag/train/instruction_2b.html";
import train_instruction_cue_0_html from "./frag/train/instruction_cue_0.html";
import train_instruction_cue_1_html from "./frag/train/instruction_cue_1.html";
import train_instruction_cue_2_html from "./frag/train/instruction_cue_2.html";
import train_instruction_retry_html from "./frag/train/instruction_retry.html";
// refresher fragments
import refresh_instruction_start_html from "./frag/refresh/instruction_start.html";
import refresh_instruction_0_html from "./frag/refresh/instruction_0.html";
import refresh_instruction_1_html from "./frag/refresh/instruction_1.html";
import refresh_instruction_2_html from "./frag/refresh/instruction_2.html";
// test fragment
import test_introduction_html from "./frag/test/introduction.html";

export class NBack {
    constructor(setNum) {
        // check for training block
        if (setNum === 1) {
            this.training = true;
        } else if (Number.isInteger(setNum) && setNum > 0) {
            this.training = false;
        } else {
            throw new Error("setNum must be a strictly positive integer");
        }
    }

    getTimeline() {
        const i = this.constructor.simpleInstruction;  // helper for simple instruction trials
        const test_block = [
            i(test_introduction_html),
            ...this.randTrialGroup(0),  // 0
            ...this.randTrialGroup(1),
            ...this.randTrialGroup(2),
            ...this.randTrialGroup(0),  // 1
            ...this.randTrialGroup(1),
            ...this.randTrialGroup(2),
            ...this.randTrialGroup(0),  // 2
            ...this.randTrialGroup(1),
            ...this.randTrialGroup(2),
            ...this.randTrialGroup(0),  // 3
            ...this.randTrialGroup(1),
            ...this.randTrialGroup(2),
        ];
        if (this.training) {
            const training_block = [
                i(train_introduction_html),
                i(train_instruction_start_html),
                i(train_instruction_0a_html),
                this.randShortPracticeLoop(0),
                i(train_instruction_0b_html),
                i(train_instruction_1a_html),
                this.randShortPracticeLoop(1),
                i(train_instruction_1b_html),
                i(train_instruction_2a_html),
                this.randShortPracticeLoop(2),
                i(train_instruction_2b_html),
                i(train_instruction_cue_0_html),
                ...this.randTrialGroup(0, 15, 4, false),
                i(train_instruction_cue_1_html),
                ...this.randTrialGroup(1, 15, 4, false),
                i(train_instruction_cue_2_html),
                ...this.randTrialGroup(2, 15, 4, false),
            ];
            return [
                ...training_block,
                ...test_block,
            ];
        } else {
            const refresher_block = [
                i(refresh_instruction_start_html),
                i(refresh_instruction_0_html),
                i(refresh_instruction_1_html),
                i(refresh_instruction_2_html),
            ];
            return [
                ...refresher_block,
                ...test_block,
            ];
        }
    }

    get taskName() {
        return this.constructor.taskName;
    }

    randShortPracticeLoop(n) {
        const passingPracticeData = data => {
            const noMiss = data.missedIndices.length === 0;
            const noIncorrect = data.responses.every(r => r.correct);
            return noMiss && noIncorrect;
        };
        return {
            timeline: [
                ...this.randTrialGroup(n, 3, 1, false),
                {
                    timeline: [this.constructor.simpleInstruction(train_instruction_retry_html)],
                    conditional_function: () => {
                        const trialData = jsPsych.data.get().filter({trial_type: "n-back"}).values()[0];
                        return !passingPracticeData(trialData);
                    }
                }
            ],
            loop_function: data => {
                const trialData = data.filter({trial_type: "n-back"}).values()[0];
                return !passingPracticeData(trialData);
            }
        };
    }

    randTrialGroup(n, length = 15, targets = 4, isRelevant = true) {
        const cue = (
            n === 0 ? this.constructor.cue0 :
            n === 1 ? this.constructor.cue1 :
            n === 2 ? this.constructor.cue2 :
            null
        );
        if (cue === null) {
            throw new Error("cue not implemented for n");
        }
        const trial = this.randTrial(n, length, targets, isRelevant);
        const rest = this.constructor.rest;
        return [cue, trial, rest];
    }

    randTrial(n, length, targets, isRelevant) {
        return {
            type: "n-back",
            n: n,
            sequence: this.randSequence(
                this.constructor.choices,
                length,
                n,
                targets
            ),
            show_duration: this.constructor.show_duration,
            hide_duration: this.constructor.hide_duration,
            data: { isRelevant: isRelevant },
        }
    }

    randSequence(choices, length, n, targets) {
        const sampleWithoutReplacement = jsPsych.randomization.sampleWithoutReplacement;
        // choose where the targets should appear in the sequence
        const indices = [...Array(length).keys()]
        const validTargetIndices = indices.filter(index => (
            n === 0 ? true : index - n >= 0
        ));
        const targetIndices = sampleWithoutReplacement(validTargetIndices, targets);
        if (targetIndices.length < targets) {
            throw new Error(
                `${n}-back sequence of length ${length} can't contain ${targets} targets`
            );
        }
        // create sequence
        const sequence = [];
        indices.forEach(index => {
            if (targetIndices.includes(index)) {
                sequence.push(n === 0 ? "1" : sequence[index - n]);
            } else {
                const [item, fallback] = sampleWithoutReplacement(choices, 2);
                if (n === 0) {
                    sequence.push(item !== "1" ? item : fallback);
                } else {
                    sequence.push(item !== sequence[index - n] ? item : fallback);
                }
            }
        });
        return sequence;
    }
}

NBack.taskName = "n-back";

NBack.choices = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
NBack.show_duration = 800;
NBack.hide_duration = 1000;

NBack.simpleInstruction = stimulus => ({
    type: "html-keyboard-response",
    stimulus: stimulus,
    choices: [" "],
});

NBack.cueDuration = 2000,
NBack.cue0 = {
    type: "html-keyboard-response",
    stimulus: cue_0_html,
    choices: jsPsych.NO_KEYS,
    trial_duration: NBack.cueDuration,
};
NBack.cue1 = {
    type: "html-keyboard-response",
    stimulus: cue_1_html,
    choices: jsPsych.NO_KEYS,
    trial_duration: NBack.cueDuration,
};
NBack.cue2 = {
    type: "html-keyboard-response",
    stimulus: cue_2_html,
    choices: jsPsych.NO_KEYS,
    trial_duration: NBack.cueDuration,
};

NBack.rest = {
    type: "html-keyboard-response",
    stimulus: rest_html,
    choices: jsPsych.NO_KEYS,
    trial_duration: 10000,
};


if (window.location.href.includes(NBack.taskName)) {
    jsPsych.init({
        timeline: (new NBack(1)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
