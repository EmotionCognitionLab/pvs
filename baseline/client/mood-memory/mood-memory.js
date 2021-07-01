import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "js/jspsych-percent-sum.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "css/jspsych-percent-sum.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import completion_html from "./frag/completion.html";

export class MoodMemory {
    getTimeline() {
        return [
            this.constructor.introduction,
            this.constructor.questionnaire,
            this.constructor.completion,
        ];
    }
}

MoodMemory.taskName = "mood-memory";

MoodMemory.introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["Continue"],
};

MoodMemory.questionnaire = {
    type: "percent-sum",
    preamble: instruction_html,
    fields: ["Good Mood", "Bad Mood", "Neutral Mood"],
    data: { isRelevant: true },
};

MoodMemory.completion = {
    type: "html-button-response",
    stimulus: completion_html,
    choices: ["Finish"],
};


if (window.location.href.includes(MoodMemory.taskName)) {
    jsPsych.init({
        timeline: (new MoodMemory()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
