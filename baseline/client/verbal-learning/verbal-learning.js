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
import pre_a_audio from "./pre-a.mp3";
import pre_b_audio from "./pre-b.mp3";
import post_a_audio from "./post-a.mp3";
import post_b_audio from "./post-b.mp3";
import check_audio from "./check.mp3";
// instruction fragments
import instruction_check_start_html from "./frag/instruction_check_start.html";
import instruction_check_loop_html from "./frag/instruction_check_loop.html";
import instruction_a_immediate_html from "./frag/instruction_a_immediate.html";
import instruction_a_immediate_rep_html from "./frag/instruction_a_immediate_rep.html";
import instruction_b_immediate_html from "./frag/instruction_b_immediate.html";
import instruction_a_short_html from "./frag/instruction_a_short.html";
import instruction_a_long_html from "./frag/instruction_a_long.html";
// presentation fragments
import presentation_cue_html from "./frag/presentation_cue.html";
import presentation_prompt_html from "./frag/presentation_prompt.html";
// recall fragments
import remember_a_immediate_html from "./frag/remember_a_immediate.html";
import remember_a_immediate_rep_html from "./frag/remember_a_immediate_rep.html";
import remember_b_immediate_html from "./frag/remember_b_immediate.html";
import remember_a_short_html from "./frag/remember_a_short.html";
import remember_a_long_html from "./frag/remember_a_long.html";
// pre-intervention cued recall fragments
import remember_a_cue_furniture_html from "./frag/remember_a_cue_furniture.html";
import remember_a_cue_vegetable_html from "./frag/remember_a_cue_vegetable.html";
import remember_a_cue_traveling_html from "./frag/remember_a_cue_traveling.html";
import remember_a_cue_animal_html from "./frag/remember_a_cue_animal.html";
// post-intervention cued recall fragments
import remember_a_cue_tool_html from "./frag/remember_a_cue_tool.html";
import remember_a_cue_fruit_html from "./frag/remember_a_cue_fruit.html";
import remember_a_cue_insect_html from "./frag/remember_a_cue_insect.html";
import remember_a_cue_clothing_html from "./frag/remember_a_cue_clothing.html";

export class VerbalLearning {
    constructor(setNum, segmentNum, getLastSegmentEndTime = null) {
        // validate setNum
        if (Number.isInteger(setNum) && 1 <= setNum && setNum < 13) {
            this.setNum = setNum;
        } else {
            throw new Error("setNum must be an integer in [1, 13)");
        }
        // validate segmentNum and compute startTime
        if (!Number.isInteger(segmentNum) || segmentNum < 1 || segmentNum > 2) {
            throw new Error("segmentNum must be an integer in 1..2");
        } else if (segmentNum === 1 && getLastSegmentEndTime !== null) {
            throw new Error("getLastSegmentEndTime must be null if segmentNum is 1");
        } else if (segmentNum === 2 && getLastSegmentEndTime === null) {
            throw new Error("getLastSegmentEndTime must not be null if segmentNum is 2");
        }
        this.segmentNum = segmentNum;
        this.getLastSegmentEndTime = getLastSegmentEndTime !== null ? getLastSegmentEndTime : () => 0;
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
        const pre = this.setNum < 7;
        const a_audio = pre ? pre_a_audio : post_a_audio;
        const b_audio = pre ? pre_b_audio : post_b_audio;
        const remember_a_cue_w_html = pre ? remember_a_cue_furniture_html : remember_a_cue_tool_html;
        const remember_a_cue_x_html = pre ? remember_a_cue_vegetable_html : remember_a_cue_fruit_html;
        const remember_a_cue_y_html = pre ? remember_a_cue_traveling_html : remember_a_cue_insect_html;
        const remember_a_cue_z_html = pre ? remember_a_cue_animal_html : remember_a_cue_clothing_html;
        if (this.segmentNum === 1) {
            return [
                this.constructor.preload,
                this.constructor.instruction(instruction_check_start_html),
                this.constructor.audio_check_loop,
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
                this.constructor.remember(remember_a_cue_w_html),
                this.constructor.remember(remember_a_cue_x_html),
                this.constructor.remember(remember_a_cue_y_html),
                this.constructor.remember(remember_a_cue_z_html),
            ];
        } else if (this.segmentNum === 2) {
            return [
                segmentCountdownNode,
                this.constructor.instruction(instruction_a_long_html),
                this.constructor.remember(remember_a_long_html),
                this.constructor.remember(remember_a_cue_w_html),
                this.constructor.remember(remember_a_cue_x_html),
                this.constructor.remember(remember_a_cue_y_html),
                this.constructor.remember(remember_a_cue_z_html),
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
    audio: [
        pre_a_audio,
        pre_b_audio,
        post_a_audio,
        post_b_audio,
        check_audio,
    ],
};

VerbalLearning.instruction = stimulus => ({
    type: "html-keyboard-response",
    stimulus: stimulus,
    choices: [" "],
});

VerbalLearning.cue = duration => ({
    type: "html-keyboard-response",
    stimulus: presentation_cue_html,
    choices: jsPsych.NO_KEYS,
    trial_duration: duration,
});
VerbalLearning.presentation = audio_stimulus => ({
    type: "audio-keyboard-response",
    stimulus: audio_stimulus,
    prompt: presentation_prompt_html,
    choices: jsPsych.NO_KEYS,
    trial_ends_after_audio: true,
});
VerbalLearning.cue_and_presentation = (audio_stimulus, duration = 2000) => [
    VerbalLearning.cue(duration),
    VerbalLearning.presentation(audio_stimulus),
];

VerbalLearning.audio_check_loop = {
    timeline: [
        ...VerbalLearning.cue_and_presentation(check_audio, 500),
        {
            type: "html-button-response",
            stimulus: instruction_check_loop_html,
            choices: ["Try Again", "Sound Worked Fine"],
        },
    ],
    loop_function: data => {
        const [buttonData] = data.filter({trial_type: "html-button-response"}).values().slice(-1);
        return buttonData.response === 0;
    }
};

VerbalLearning.remember = stimulus => ({
    type: "memory-field",
    stimulus: stimulus,
    button_label: "Stop",
    confirm_text: "Click OK if you've thought of all the words you can. Click cancel if you can remember more.",
    data: { isRelevant: true },
});


if (window.location.href.includes(VerbalLearning.taskName)) {
    jsPsych.init({
        timeline: [
            {timeline: new VerbalLearning(1, 1).getTimeline()},
            {timeline: new VerbalLearning(1, 2, () => Date.now()).getTimeline()},
        ],
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
