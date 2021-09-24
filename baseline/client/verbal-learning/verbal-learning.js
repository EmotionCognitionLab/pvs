import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-call-function.js";
import "@adp-psych/jspsych/plugins/jspsych-preload.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/plugins/jspsych-audio-keyboard-response.js";
import "js/jspsych-memory-field.js";
import "js/jspsych-countdown.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-memory-field.css";
import "css/common.css";
import "./style.css";
// audio stimuli
import a_audio from "./a.ogg";
import b_audio from "./b.ogg";
// introduction and completion fragments
import introduction_html from "./frag/introduction.html";
import completion_html from "./frag/completion.html";
// instruction fragments
import instruction_a_immediate_html from "./frag/instruction_a_immediate.html";
import instruction_a_immediate_rep_html from "./frag/instruction_a_immediate_rep.html";
import instruction_b_immediate_html from "./frag/instruction_b_immediate.html";
import instruction_a_short_html from "./frag/instruction_a_short.html";
import instruction_a_cue_furniture_html from "./frag/instruction_a_cue_furniture.html";
import instruction_a_cue_vegetable_html from "./frag/instruction_a_cue_vegetable.html";
import instruction_a_cue_traveling_html from "./frag/instruction_a_cue_traveling.html";
import instruction_a_cue_animal_html from "./frag/instruction_a_cue_animal.html";
import instruction_a_long_html from "./frag/instruction_a_long.html";
// presentation fragments
import presentation_cue_html from "./frag/presentation_cue.html";
import presentation_prompt_html from "./frag/presentation_prompt.html";
// remember fragments
import remember_a_immediate_html from "./frag/remember_a_immediate.html";
import remember_a_immediate_rep_html from "./frag/remember_a_immediate_rep.html";
import remember_b_immediate_html from "./frag/remember_b_immediate.html";
import remember_a_short_html from "./frag/remember_a_short.html";
import remember_a_cue_furniture_html from "./frag/remember_a_cue_furniture.html";
import remember_a_cue_vegetable_html from "./frag/remember_a_cue_vegetable.html";
import remember_a_cue_traveling_html from "./frag/remember_a_cue_traveling.html";
import remember_a_cue_animal_html from "./frag/remember_a_cue_animal.html";
import remember_a_long_html from "./frag/remember_a_long.html";

export class VerbalLearning {
    constructor(setNum, segmentNum, getLastSegmentEndTime) {
        // validate setNum
        if (Number.isInteger(setNum) && setNum > 0) {
            this.setNum = setNum;
        } else {
            throw new Error("setNum must be a strictly positive integer");
        }
        // validate segmentNum and compute startTime
        if (segmentNum < 1 || segmentNum > 2) throw new Error("segmentNum must be in 1..2");
        this.segmentNum = segmentNum;
        this.getLastSegmentEndTime = getLastSegmentEndTime;
    }

    getTimeline() {
        const glset = this.getLastSegmentEndTime.bind(this);
        const segmentCountdownNode = {
            timeline: [{
                type: "call-function",
                async: true,
                func: async function(done) {
                    const lastSegEndTime = await glset();
                    const dur = (lastSegEndTime + (20 * 60 * 1000))  - Date.now();  // 20 minutes
                    done({duration: dur});
                }
            },
            {
                timeline: [{
                    type: "countdown",
                    duration: function() {
                        const data = jsPsych.data.get().last(1).values()[0];
                        return data.value.duration;
                    }
                }],
                conditional_function: function() {
                    const data = jsPsych.data.get().last(1).values()[0];
                    return data.value.duration > 0;
                }
            }]
        };
        if (this.segmentNum === 1) {
            return [
                this.constructor.preload,
                this.constructor.introduction,
                this.constructor.instruction(instruction_a_immediate_html),  // 1
                ...this.constructor.cue_and_presentation(a_audio),
                this.constructor.remember(remember_a_immediate_html),
                this.constructor.instruction(instruction_a_immediate_rep_html),  // 2
                ...this.constructor.cue_and_presentation(a_audio),
                this.constructor.remember(remember_a_immediate_rep_html),
                this.constructor.instruction(instruction_a_immediate_rep_html),  // 3
                ...this.constructor.cue_and_presentation(a_audio),
                this.constructor.remember(remember_a_immediate_rep_html),
                this.constructor.instruction(instruction_a_immediate_rep_html),  // 4
                ...this.constructor.cue_and_presentation(a_audio),
                this.constructor.remember(remember_a_immediate_rep_html),
                this.constructor.instruction(instruction_a_immediate_rep_html),  // 5
                ...this.constructor.cue_and_presentation(a_audio),
                this.constructor.remember(remember_a_immediate_rep_html),
                this.constructor.instruction(instruction_b_immediate_html),
                ...this.constructor.cue_and_presentation(b_audio),
                this.constructor.remember(remember_b_immediate_html),
                this.constructor.instruction(instruction_a_short_html),
                this.constructor.remember(remember_a_short_html),
                this.constructor.instruction(instruction_a_cue_furniture_html),
                this.constructor.remember(remember_a_cue_furniture_html),
                this.constructor.instruction(instruction_a_cue_vegetable_html),
                this.constructor.remember(remember_a_cue_vegetable_html),
                this.constructor.instruction(instruction_a_cue_traveling_html),
                this.constructor.remember(remember_a_cue_traveling_html),
                this.constructor.instruction(instruction_a_cue_animal_html),
                this.constructor.remember(remember_a_cue_animal_html),
            ];
        } else if (this.segmentNum === 2) {
            return [
                segmentCountdownNode,
                this.constructor.instruction(instruction_a_long_html),
                this.constructor.remember(remember_a_long_html),
                this.constructor.instruction(instruction_a_cue_furniture_html),
                this.constructor.remember(remember_a_cue_furniture_html),
                this.constructor.instruction(instruction_a_cue_vegetable_html),
                this.constructor.remember(remember_a_cue_vegetable_html),
                this.constructor.instruction(instruction_a_cue_traveling_html),
                this.constructor.remember(remember_a_cue_traveling_html),
                this.constructor.instruction(instruction_a_cue_animal_html),
                this.constructor.remember(remember_a_cue_animal_html),
                this.constructor.completion,
            ];
        } else {
            throw new Error("segmentNum must be in 1..2");
        }
    }

    get taskName() {
        if (this.segmentNum === 1) {
            return this.constructor.taskName + "-learning";
        }
        return this.constructor.taskName + "-recall";
    }
}

VerbalLearning.taskName = "verbal-learning";

VerbalLearning.preload = {
    type: "preload",
    audio: [a_audio, b_audio],
};

VerbalLearning.introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["Continue"],
};

VerbalLearning.instruction = stimulus => ({
    type: "html-button-response",
    stimulus: stimulus,
    choices: ["Start"],
});

VerbalLearning.cue = {
    type: "html-keyboard-response",
    stimulus: presentation_cue_html,
    choices: jsPsych.NO_KEYS,
    trial_duration: 2000,
};
VerbalLearning.presentation = audio_stimulus => ({
    type: "audio-keyboard-response",
    stimulus: audio_stimulus,
    prompt: presentation_prompt_html,
    choices: jsPsych.NO_KEYS,
    trial_ends_after_audio: true,
});
VerbalLearning.cue_and_presentation = audio_stimulus => [
    VerbalLearning.cue,
    VerbalLearning.presentation(audio_stimulus),
];

VerbalLearning.remember = stimulus => ({
    type: "memory-field",
    stimulus: stimulus,
    button_label: "Stop",
    data: { isRelevant: true },
});

VerbalLearning.completion = {
    type: "html-button-response",
    stimulus: completion_html,
    choices: ["Finish"],
};


if (window.location.href.includes(VerbalLearning.taskName)) {
    jsPsych.init({
        timeline: [
            {timeline: new VerbalLearning(1, 1, () => 0).getTimeline()},
            {timeline: new VerbalLearning(1, 2, () => Date.now()).getTimeline()},
        ],
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
