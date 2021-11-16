import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "../js/jspsych-timed-writing.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "css/jspsych-timed-writing.css";
import "./style.css";
import instruction_html from "./frag/instruction.html";
import stimulus_template_html from "./frag/stimulus-template.html";

export class VerbalFluency {
    constructor(letter) {
        if (this.constructor.possibleLetters.includes(letter)) {
            this.letter = letter;
        } else {
            throw new Error("unsupported letter");
        }
    }
    
    trial() {
        return {
            type: "timed-writing",
            duration: 60000,
            stimulus: stimulus_template_html.replace(/{letter}/g, this.letter),
            textarea_rows: 6,
            textarea_cols: 60,
            data: { letter: this.letter, isRelevant: true },
        };
    }
    
    getTimeline() {
        return [
            this.constructor.instruction,
            this.trial(),
        ];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

VerbalFluency.taskName = "verbal-fluency";
VerbalFluency.possibleLetters = ["s", "c", "f", "a", "d", "p"];

VerbalFluency.instruction = {
    type: "html-keyboard-response",
    stimulus: instruction_html,
    choices: [" "],
};

if (window.location.href.includes(VerbalFluency.taskName)) {
    jsPsych.init({
        timeline: (new VerbalFluency("f")).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}

