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
                this.constructor.training_procedure,
                this.constructor.fixation,
                this.constructor.trial([1, 1, 1, 1, 1]),
                this.constructor.fixation,
                this.constructor.trial([0, 0, 0, 0, 0]),
                this.constructor.fixation,
                this.constructor.trial([1, 1, 0, 1, 1]),
                this.constructor.completion,
            ];
        } else {
            return [
                this.constructor.preload,
                this.constructor.introduction,
                this.constructor.instruction1,
                this.constructor.fixation,
                this.constructor.trial([1, 1, 1, 1, 1]),
                this.constructor.fixation,
                this.constructor.trial([0, 0, 0, 0, 0]),
                this.constructor.fixation,
                this.constructor.trial([1, 1, 0, 1, 1]),
                this.constructor.completion,
            ];
        }
        
    }

    get taskName() {
        return this.constructor.taskName;
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
Flanker.trial = arrows => {
    return {
        type: "html-keyboard-response",
        stimulus: Flanker.stimulus(arrows),
        choices: ["ArrowLeft", "ArrowRight"],
        data: { arrows: arrows, isRelevant: true }
    };
};

Flanker.traiing_stimuli = [ [1, 1, 1, 1, 1], [1, 1, 0, 1, 1], [0, 0, 1, 0, 0], [0, 0, 0, 0, 0] ]
    .map(arrows => ( { 
        stimulus: Flanker.stimulus(arrows), 
        arrows: arrows, 
        correct_response: arrows[2] === 1 ? "arrowright": "arrowleft" 
        } )
    );

Flanker.test = {
    type: "html-keyboard-response",
    stimulus: jsPsych.timelineVariable("stimulus"),
    choices: ["ArrowLeft", "ArrowRight"],
    data: { 
        isTrial: true,
        correct_response: jsPsych.timelineVariable("correct_response"),
        arrows: jsPsych.timelineVariable("arrows")
    },
    on_finish: function(data){
        data.correct = jsPsych.pluginAPI.compareKeys(data.response, data.correct_response);
    }
}

Flanker.feedback = {
    type: "html-keyboard-response",
    stimulus: function() {
        const data = jsPsych.data.getLastTimelineData();
        return data.last(1).values()[0].correct ? "Correct": "Incorrect"
    },
    choices: jsPsych.NO_KEYS,
    trial_duration: 800
}

Flanker.training_procedure = {
    timeline: [Flanker.fixation, Flanker.test, Flanker.feedback],
    timeline_variables: Flanker.traiing_stimuli,
    randomize_order: true
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
