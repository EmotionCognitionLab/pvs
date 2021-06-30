import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "../js/jspsych-timed-writing.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-timed-writing.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import stimulus_template_html from "./frag/stimulus-template.html";
import completion_html from "./frag/completion.html";

export class VerbalFluency {
    constructor(letter) {
        this.letter = letter;
    }
    
    trial() {
        return {
            type: "timed-writing",
            duration: 60000,
            stimulus: stimulus_template_html.replaceAll("{letter}", this.letter),
            textarea_rows: 6,
            textarea_cols: 60,
            data: { letter: this.letter },
        };
    }
    
    getTimeline() {
        return [
            this.constructor.introduction,
            this.constructor.instruction,
            this.trial(),
            this.constructor.completion,
        ];
    }
}

VerbalFluency.taskName = "verbal-fluency";
VerbalFluency.possibleLetters = ["s", "c", "f", "a", "d", "p"];
VerbalFluency.introduction = {
    type: "html-keyboard-response",
    stimulus: introduction_html,
    choices: [" "],
};

VerbalFluency.instruction = {
    type: "html-keyboard-response",
    stimulus: instruction_html,
    choices: [" "],
};

VerbalFluency.completion = {
    type: "html-keyboard-response",
    stimulus: completion_html,
    choices: [" "],
};


if (window.location.href.includes("verbal-fluency")) {
    const vf = new VerbalFluency("f");
    jsPsych.init({
        timeline: vf.getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}

