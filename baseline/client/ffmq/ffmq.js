import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-likert.js";
import "@adp-psych/jspsych/css/jspsych.css";
import instruction_html from "./frag/introduction.html";
import "css/jspsych-survey-likert-patch.css";

export class Ffmq {
    getTimeline() {
        return [ this.constructor.questionnaire ];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

Ffmq.taskName = "ffmq";

Ffmq.labels = [
    "Never or very rarely true",
    "Rarely true",
    "Sometimes true",
    "Often true",
    "Very often or always true",
];

Ffmq.question = item => ({
    prompt: item,
    name: item,
    labels: Ffmq.labels,
    required: true,
});

Ffmq.questionnaire = {
    type: "survey-likert",
    preamble: instruction_html,
    questions: [
        "When I take a shower or a bath, I stay alert to the sensations of water on my body.",
        "I’m good at finding words to describe my feelings.",
        "I don’t pay attention to what I’m doing because I’m daydreaming, worrying, or otherwise distracted.",
        "I believe some of my thoughts are abnormal or bad and I shouldn’t think that way.",
        "When I have distressing thoughts or images, I “step back” and am aware of the thought or image without getting taken over by it.",
        "I notice how foods and drinks affect my thoughts, bodily sensations, and emotions.",
        "I have trouble thinking of the right words to express how I feel about things.",
        "I do jobs or tasks automatically without being aware of what I’m doing.",
        "I think some of my emotions are bad or inappropriate and I shouldn’t feel them.",
        "When I have distressing thoughts or images I am able just to notice them without reacting.",
        "I pay attention to sensations, such as the wind in my hair or the sun on my face.",
        "Even when I’m feeling terribly upset I can find a way to put it into words.",
        "I find myself doing things without paying attention.",
        "I tell myself I shouldn’t be feeling the way I’m feeling.",
        "When I have distressing thoughts or images I just notice them and let them go."
    ].map(Ffmq.question),
    data: { isRelevant: true },
};

if (window.location.href.includes(Ffmq.taskName)) {
    jsPsych.init({
        timeline: (new Ffmq()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
