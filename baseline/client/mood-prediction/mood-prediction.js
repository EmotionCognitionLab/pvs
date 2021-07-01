import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "js/jspsych-percent-sum.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "css/jspsych-percent-sum.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import completion_html from "./frag/completion.html";

export class MoodPrediction {
    getTimeline() {
        return [
            this.constructor.introduction,
            this.constructor.questionnaire,
            this.constructor.completion,
        ];
    }
}

MoodPrediction.taskName = "mood-prediction";

MoodPrediction.introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["Continue"],
};

MoodPrediction.questionnaire = {
    type: "percent-sum",
    preamble: instruction_html,
    fields: ["Good Mood", "Bad Mood", "Neutral Mood"],
    data: { isRelevant: true },
};

MoodPrediction.completion = {
    type: "html-button-response",
    stimulus: completion_html,
    choices: ["Finish"],
};


if (window.location.href.includes(MoodPrediction.taskName)) {
    jsPsych.init({
        timeline: (new MoodPrediction()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
