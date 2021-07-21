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
                this.constructor.trial([1, 1, 1, 1, 1]),
                this.constructor.trial([1, 1, 0, 1, 1]),
                this.constructor.trial([0, 0, 1, 0, 0]),
                this.constructor.trial([0, 0, 0, 0, 0]),
                this.constructor.trial([1, 1, 1, 1, 1]),
                this.constructor.trial([0, 0, 0, 0, 0]),
                this.constructor.trial([1, 1, 0, 1, 1]),
                this.constructor.completion,
            ];
        } else {
            return [
                this.constructor.preload,
                this.constructor.introduction,
                this.constructor.instruction,
                this.constructor.trial([1, 1, 1, 1, 1]),
                this.constructor.trial([0, 0, 0, 0, 0]),
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

Flanker.stimulus = arrows => {
    const head = "<div class=\"arrows\">";
    const body = arrows.map(
        is_right => `<img class=${is_right ? "right" : "left"} src=${arrow_img}>`
    ).join("");
    const tail = "</div><div><em>Press <b>f</b> or <b>j</b>.</em></div>";
    return head + body + tail;
};
Flanker.trial = arrows => {
    return {
        type: "html-keyboard-response",
        stimulus: Flanker.stimulus(arrows),
        choices: ["f", "j"],
        data: { arrows: arrows, isRelevant: true }
    };
};

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
