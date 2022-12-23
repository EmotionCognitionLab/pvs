import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-preload.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "./style.css";
import arrow_img from "./arrow.png";
import instruction1_html from "./frag/instruction-1.html";
import instruction2_html from "./frag/instruction-2.html";
import instruction3_html from "./frag/instruction-3.html";
import instruction4_html from "./frag/instruction-4.html";
import instruction5_html from "./frag/instruction-5.html";
import instruction6_html from "./frag/instruction-6.html";
import comprehension1_html from "./frag/comprehension-1.html";
import comprehension2_html from "./frag/comprehension-2.html";
import comprehension3_html from "./frag/comprehension-3.html";
import instruction1alt_html from "./frag/instruction-1-alt.html";



export class Flanker {
    constructor(setNum) {
        this.setNum = setNum;
        this.currentResponseTimeLimitMs = this.constructor.defaultResponseTimeLimitMs;
    }

    getTimeline() {
        if (this.setNum === 1 || this.setNum === 7) {
            return [
                this.constructor.preload,
                this.constructor.instruction1,
                this.constructor.instruction2,
                this.constructor.instruction3,
                this.constructor.instruction4,
                this.constructor.instruction5,
                this.trainingLoop(),
                this.constructor.instruction6,
                this.mainTrials(),
            ];
        } else {
            return [
                this.constructor.preload,
                this.constructor.instruction1alt,
                this.mainTrials(),
            ];
        }
        
    }

    responseTimeLimitMs() {
        const trialsPerBlock = this.constructor.mainStimuli.length;
        const allResults = jsPsych.data.get().filterCustom(data => data.arrows && !data.isTraining).values();
        if (allResults.length === 0 || allResults.length % trialsPerBlock !== 0) {
            // we're in the middle of a block (or at the start of the experiment)
            // changes to the response time limit are only made at the end of a block
            return this.currentResponseTimeLimitMs;
        }

        // ok, now see how we need to change the response time based on performance in the block
        let reductionMs;
        let increaseMs;
        const blockNum = allResults.length / trialsPerBlock;
        if (blockNum <= 6) {
            reductionMs = 90;
            increaseMs = 270;
        } else {
            reductionMs = 30;
            increaseMs = 90;
        }

        const blockResults = allResults.slice(allResults.length - trialsPerBlock);
        const correctResultsCount = blockResults.filter(r => r.correct).length;
        if (correctResultsCount >= 13) {
            this.currentResponseTimeLimitMs -= reductionMs;
        } else {
            this.currentResponseTimeLimitMs += increaseMs;
        }
        return this.currentResponseTimeLimitMs;
    }

    get taskName() {
        return this.constructor.taskName;
    }

    trial(isTraining) {
        const result = {
            type: "html-keyboard-response",
            stimulus: jsPsych.timelineVariable("stimulus"),
            choices: ["ArrowLeft", "ArrowRight"],
            data: { 
                correct_response: jsPsych.timelineVariable("correct_response"),
                arrows: jsPsych.timelineVariable("arrows"),
                set: this.setNum,
                congruent: jsPsych.timelineVariable("congruent"),
            },
            on_finish: function(data){
                data.correct = jsPsych.pluginAPI.compareKeys(data.response, data.correct_response);
            },
            save_trial_parameters: {trial_duration: true},
            trial_duration: this.responseTimeLimitMs.bind(this),
        };

        if (isTraining) {
            result.data.isTraining = true;
        } else {
            result.data.isRelevant = true;
        }

        return result;
    }

    trainingTrials() {
        return {
            timeline: [this.constructor.fixation, this.trial(true), this.constructor.trainingFeedback],
            timeline_variables: this.constructor.timelineVarsForStimuli(this.constructor.trainingStimuli),
            randomize_order: true
        };
    }

    mainTrials() {
        return {
            timeline: [this.constructor.fixation, this.trial(false), this.constructor.mainFeedbackNode],
            timeline_variables: this.constructor.timelineVarsForStimuli(this.constructor.mainStimuli),
            repetitions: this.constructor.numMainBlocks,
            randomize_order: true
        };
    }
    
    trainingLoop() {
        return {
            timeline: [this.trainingTrials(), this.constructor.comprehensionNode],
            loop_function: function(data) {
                return data.filter({isTraining: true, correct: true}).values().length < 3;
            }
        };
    }
}

Flanker.taskName = "flanker";

Flanker.preload = {
    type: "preload",
    images: [arrow_img]
};

Flanker.instruction1 = {
    type: "html-keyboard-response",
    stimulus: instruction1_html,
    choices: [" "]
};

Flanker.instruction2 = {
    type: "html-keyboard-response",
    stimulus: instruction2_html,
    choices: ["ArrowLeft"]
};

Flanker.instruction3 = {
    type: "html-keyboard-response",
    stimulus: instruction3_html,
    choices: ["ArrowRight"]
};

Flanker.instruction4 = {
    type: "html-keyboard-response",
    stimulus: instruction4_html,
    choices: ["ArrowRight"]
};

Flanker.instruction5 = {
    type: "html-keyboard-response",
    stimulus: instruction5_html,
    choices: [" "]
};

Flanker.instruction6 = {
    type: "html-keyboard-response",
    stimulus: instruction6_html,
    choices: [" "]
};

Flanker.instruction1alt = {
    type: "html-keyboard-response",
    stimulus: instruction1alt_html,
    choices: [" "]
};

Flanker.fixation = {
    type: "html-keyboard-response",
    stimulus: '<div style="font-size: 60px;">+</div>',
    trial_duration: function() {
        return Math.floor((Math.random() * 300) + 400);
    },
    choices: jsPsych.NO_KEYS
};

Flanker.stimulus = arrows => {
    const head = "<div class=\"arrows\">";
    const body = arrows.map(
        is_right => `<img class=${is_right ? "flanker-right" : "flanker-left"} src=${arrow_img}>`
    ).join("");
    const tail = "</div><div>Press the left arrow key or the right arrow key.</em></div>";
    return head + body + tail;
};

// changing the order of these stimuli will break the 
// "it does not show the comprehension screens if you get three or more of the training trials right" test
Flanker.trainingStimuli = [ [1, 1, 1, 1, 1], [1, 1, 0, 1, 1], [0, 0, 1, 0, 0], [0, 0, 0, 0, 0] ];

Flanker.mainStimuli = [ [1, 1, 1, 1, 1], [1, 1, 0, 1, 1], [0, 0, 1, 0, 0], [0, 0, 0, 0, 0],
                        [1, 1, 1, 1, 1], [1, 1, 0, 1, 1], [0, 0, 1, 0, 0], [0, 0, 0, 0, 0],
                        [1, 1, 1, 1, 1], [1, 1, 0, 1, 1], [0, 0, 1, 0, 0], [0, 0, 0, 0, 0],
                        [1, 1, 1, 1, 1], [1, 1, 0, 1, 1], [0, 0, 1, 0, 0], [0, 0, 0, 0, 0] ];

Flanker.timelineVarsForStimuli = (stimuli) => {
    return stimuli.map(arrows => ( { 
        stimulus: Flanker.stimulus(arrows), 
        arrows: arrows, 
        correct_response: arrows[2] === 1 ? "arrowright": "arrowleft",
        congruent: arrows[2] === arrows[1]
    }));
};

Flanker.trainingFeedback = {
    type: "html-keyboard-response",
    stimulus: function() {
        const data = jsPsych.data.getLastTimelineData();
        const values = data.last(1).values()[0];
        if (values.response === null) {
            return '<span class="flanker-miss"></span>';
        }
        if (values.correct) {
            return "Correct";
        }
        return "Incorrect";
    },
    choices: jsPsych.NO_KEYS,
    trial_duration: 800
};

Flanker.mainFeedback = {
    type: "html-keyboard-response",
    stimulus: "Answer faster next time",
    choices: jsPsych.NO_KEYS,
    trial_duration: 800
};

Flanker.mainFeedbackNode = {
    timeline: [Flanker.mainFeedback],
    conditional_function: function() {
        const data = jsPsych.data.getLastTimelineData();
        const values = data.last(1).values()[0];
        return values.response === null;
    }
};

Flanker.comprehension1 = {
    type: "html-keyboard-response",
    stimulus: comprehension1_html,
    choices: ["ArrowRight", "ArrowLeft"],
    data: { isComprehension: true }
};

Flanker.comprehension2 = {
    type: "html-keyboard-response",
    stimulus: comprehension2_html,
    choices: ["ArrowRight", "ArrowLeft"],
    data: { isComprehension: true }
};

Flanker.comprehension3 = {
    type: "html-keyboard-response",
    stimulus: comprehension3_html,
    choices: [" "],
    data: { isComprehension: true }
};

Flanker.comprehensionNode = {
    timeline: [Flanker.comprehension1, Flanker.comprehension2, Flanker.comprehension3],
    conditional_function: function() {
        return jsPsych.data.getLastTimelineData().filter({isTraining: true, correct: true}).values().length < 3;
    }
};

Flanker.numMainBlocks = 9;
Flanker.defaultResponseTimeLimitMs = 1050;

if (window.location.href.includes(Flanker.taskName)) {
    jsPsych.init({
        timeline: (new Flanker(1)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
