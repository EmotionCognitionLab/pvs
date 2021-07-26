import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-preload.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "./style.css";
import arrow_img from "./arrow.png";
import introduction_html from "./frag/introduction.html";
import instruction1_html from "./frag/instruction-1.html";
import instruction2_html from "./frag/instruction-2.html";
import instruction3_html from "./frag/instruction-3.html";
import instruction4_html from "./frag/instruction-4.html";
import instruction5_html from "./frag/instruction-5.html";
import completion_html from "./frag/completion.html";
import comprehension1_html from "./frag/comprehension-1.html";
import comprehension2_html from "./frag/comprehension-2.html";
import comprehension3_html from "./frag/comprehension-3.html";


export class Flanker {
    constructor(setNum) {
        this.setNum = setNum;
    }

    getTimeline() {
        if (this.setNum === 1) {
            return [
                this.constructor.preload,
                this.constructor.introduction,
                this.constructor.instruction1,
                this.constructor.instruction2,
                this.constructor.instruction3,
                this.constructor.instruction4,
                this.constructor.instruction5,
                this.trainingLoop(),
                this.mainTrials(),
                this.constructor.completion,
            ];
        } else {
            return [
                this.constructor.preload,
                this.constructor.introduction,
                this.constructor.instruction1,
                this.mainTrials(),
                this.constructor.completion,
            ];
        }
        
    }

    get taskName() {
        return this.constructor.taskName;
    }

    trial(isTraining, durationMs) {
        const result = {
            type: "html-keyboard-response",
            stimulus: jsPsych.timelineVariable("stimulus"),
            choices: ["ArrowLeft", "ArrowRight"],
            data: { 
                correct_response: jsPsych.timelineVariable("correct_response"),
                arrows: jsPsych.timelineVariable("arrows"),
                set: this.setNum
            },
            on_finish: function(data){
                data.correct = jsPsych.pluginAPI.compareKeys(data.response, data.correct_response);
            },
            trial_duration: durationMs
        }

        if (isTraining) {
            result.data.isTraining = true;
        } else {
            result.data.isRelevant = true;
        }

        return result;
    }

    trainingTrials() {
        return {
            timeline: [this.constructor.fixation, this.trial(true, 1050), this.constructor.feedback],
            timeline_variables: this.constructor.stimuli,
            randomize_order: true
        }
    }

    mainTrials() {
        return {
            timeline: [this.constructor.fixation, this.trial(false, 1050)],
            timeline_variables: this.constructor.stimuli,
            sample: {
                type: "fixed-repetitions",
                size: 4
            },
            randomize_order: true
        }
    }
    
    trainingLoop() {
        return {
            timeline: [this.trainingTrials(), this.constructor.comprehensionNode],
            loop_function: function(data) {
                return data.filter({isTraining: true, correct: true}).values().length < 3;
            }
        }
    }
}

Flanker.taskName = "flanker";

Flanker.preload = {
    type: "preload",
    images: [arrow_img]
}

Flanker.introduction = {
    type: "html-keyboard-response",
    stimulus: introduction_html
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

Flanker.fixation = {
    type: "html-keyboard-response",
    stimulus: '<div style="font-size: 60px;">+</div>',
    trial_duration: function() {
        return Math.floor((Math.random() * 300) + 400);
    },
    choices: jsPsych.NO_KEYS
}

Flanker.stimulus = arrows => {
    const head = "<div class=\"arrows\">";
    const body = arrows.map(
        is_right => `<img class=${is_right ? "right" : "left"} src=${arrow_img}>`
    ).join("");
    const tail = "</div><div>Press the left arrow key or the right arrow key.</em></div>";
    return head + body + tail;
};

// changing the order of these stimuli will break the 
// "it does not show the comprehension screens if you get three or more of the training trials right" test
Flanker.stimuli = [ [1, 1, 1, 1, 1], [1, 1, 0, 1, 1], [0, 0, 1, 0, 0], [0, 0, 0, 0, 0] ]
    .map(arrows => ( { 
        stimulus: Flanker.stimulus(arrows), 
        arrows: arrows, 
        correct_response: arrows[2] === 1 ? "arrowright": "arrowleft" 
        } )
    );

Flanker.feedback = {
    type: "html-keyboard-response",
    stimulus: function() {
        const data = jsPsych.data.getLastTimelineData();
        const values = data.last(1).values()[0];
        if (values.response === null) {
            return "Answer faster next time";
        }
        if (values.correct) {
            return "Correct";
        }
        return "Incorrect";
    },
    choices: jsPsych.NO_KEYS,
    trial_duration: 800
}

Flanker.comprehension1 = {
    type: "html-keyboard-response",
    stimulus: comprehension1_html,
    choices: ["ArrowRight", "ArrowLeft"],
    data: { isComprehension: true }
}

Flanker.comprehension2 = {
    type: "html-keyboard-response",
    stimulus: comprehension2_html,
    choices: ["ArrowRight", "ArrowLeft"],
    data: { isComprehension: true }
}

Flanker.comprehension3 = {
    type: "html-keyboard-response",
    stimulus: comprehension3_html,
    choices: [" "],
    data: { isComprehension: true }
}

Flanker.comprehensionNode = {
    timeline: [Flanker.comprehension1, Flanker.comprehension2, Flanker.comprehension3],
    conditional_function: function() {
        return jsPsych.data.getLastTimelineData().filter({isTraining: true, correct: true}).values().length < 3;
    }
}

Flanker.completion = {
    type: "html-keyboard-response",
    stimulus: completion_html
}


if (window.location.href.includes(Flanker.taskName)) {
    jsPsych.init({
        timeline: (new Flanker(1)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
