import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-likert.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-survey-likert-patch.css";
import "./style.css";
import instruction_html from "./frag/instruction.html";

export class Panas {
    getTimeline() {
        return [
            this.constructor.questionnaire,
        ];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

Panas.taskName = "panas";

Panas.labels = [
    "Very slightly or not at all",
    "A little",
    "Moderately",
    "Quite a bit",
    "Extremely",
];
Panas.question = item => ({
    prompt: item,
    name: item.toLowerCase(),
    labels: Panas.labels,
    required: true,
});
Panas.questionnaire = {
    type: "survey-likert",
    preamble: instruction_html,
    questions: [
        "Interested",
        "Distressed",
        "Excited",
        "Upset",
        "Strong",
        "Guilty",
        "Scared",
        "Hostile",
        "Enthusiastic",
        "Proud",
        "Irritable",
        "Alert",
        "Ashamed",
        "Inspired",
        "Nervous",
        "Determined",
        "Attentive",
        "Jittery",
        "Active",
        "Afraid",
    ].map(Panas.question),
    data: { isRelevant: true },
};

if (window.location.href.includes(Panas.taskName)) {
    jsPsych.init({
        timeline: (new Panas()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
