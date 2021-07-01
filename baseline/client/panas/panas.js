import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-likert.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-survey-likert-patch.css";
import "./style.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instruction.html";
import completion_html from "./frag/completion.html";

export class Panas {
    getTimeline() {
        return [
            this.constructor.introduction,
            this.constructor.questionnaire,
            this.constructor.completion,
        ];
    }
}

Panas.taskName = "panas";

Panas.introduction = {
    type: "html-button-response",
    stimulus: introduction_html,
    choices: ["Continue"],
};

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
};

Panas.completion = {
    type: "html-button-response",
    stimulus: completion_html,
    choices: ["Finish"],
};


if (window.location.href.includes(Panas.taskName)) {
    jsPsych.init({
        timeline: (new Panas()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
