import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "js/jspsych-percent-sum.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "css/jspsych-percent-sum.css";
import instruction_html from "./frag/instruction.html";

export class MoodMemory {
    getTimeline() {
        return [this.constructor.questionnaire];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

MoodMemory.taskName = "mood-memory";

MoodMemory.questionnaire = {
    type: "percent-sum",
    preamble: instruction_html,
    fields: ["Good Mood", "Bad Mood", "Neutral Mood"],
    data: { isRelevant: true },
};

if (window.location.href.includes(MoodMemory.taskName)) {
    jsPsych.init({
        timeline: (new MoodMemory()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
