import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-likert.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "css/jspsych-survey-likert-patch.css";
import instruction1_html from "./frag/instruction1.html";
import instruction2_html from "./frag/instruction2.html";

export class SleepSurvey {
    getTimeline() {
        return this.constructor.questionnaire();
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

SleepSurvey.taskName = "sleep-survey";

SleepSurvey.labels = [
    "No chance of dozing",
    "Slight chance of dozing",
    "Moderate chance of dozing",
    "High chance of dozing",
];

SleepSurvey.question = item => ({
    prompt: item,
    name: item.toLowerCase(),
    labels: SleepSurvey.labels,
    required: true,
});

SleepSurvey.questionnaire = () => {
    const first = { 
        type: "survey-likert",
        preamble: instruction1_html,
        questions: [
            "Sitting and reading",
            "Watching TV",
            "Sitting inactive in a public place (e.g., a theater or a meeting)",
            "As a passenger in a car for an hour without a break",
            "Lying down to rest in the afternoon when circumstances permit",
            "Sitting and talking to someone",
            "Sitting quietly after a lunch without alcohol",
            "In a car, while stopped for a few minutes in traffic",
        ].map(SleepSurvey.question),
        data: { isRelevant: true }
    };
    const second = {
        type: "survey-likert",
        preamble: instruction2_html,
        questions: [
            {
                prompt: "",
                name: "sleepiness five minutes before",
                labels: [
                    "Extremely alert",
                    "Very alert",
                    "Alert",
                    "Rather alert",
                    "Neither alert nor sleepy",
                    "Some signs of sleepiness",
                    "Sleepy, but no effort to keep awake",
                    "Sleepy, some effort to keep awake",
                    "Very sleepy, great effort to keep awake, fighting sleep"
                ],
                required: true
            }
        ],
        data: { isRelevant: true }
    };

    return [first, second];
};

if (window.location.href.includes(SleepSurvey.taskName)) {
    jsPsych.init({
        timeline: (new SleepSurvey()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
