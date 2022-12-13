import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/plugins/jspsych-image-keyboard-response.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-text.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "./style.css";
// stimulus
import stimulus from "./stim.json";
// fragments
import learning_instruction_html from "./frag/learning_instruction.html";
import learning_prompt_html from "./frag/learning_prompt.html";
import recall_instruction_html from "./frag/recall_instruction.html";

export class EmotionalMemory {
    constructor(setNum) {
        if (setNum === 4 || setNum === 10) {
            this.learning = true;
        } else if (setNum === 6 || setNum === 12) {
            this.learning = false;
        } else {
            throw new Error("invalid setNum " + setNum.toString());
        }
        this.setNum = setNum;
    }

    getTimelineLearning() {
        // imagePaths
        const imagePaths = (
            this.setNum === 4 ? stimulus.pre :
            this.setNum === 10 ? stimulus.post :
            null
        );
        if (!imagePaths) {
            throw new Error("no images for setNum");
        }
        const shuffledImagePaths = jsPsych.randomization.shuffle(imagePaths);
        const pairs = shuffledImagePaths.map(imagePath => [
            this.constructor.learningEncodingTrial(imagePath),
            this.constructor.learningRatingTrial(imagePath),
        ]);
        // timeline
        return [
            this.constructor.learningInstructionTrial,
            ...pairs.flat(),
        ];
    }

    getTimelineRecall() {
        return [this.constructor.recallLoop];
    }

    getTimeline() {
        return this.learning ? this.getTimelineLearning() : this.getTimelineRecall();
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

EmotionalMemory.taskName = "emotional-memory";
EmotionalMemory.imageBucket = "https://d3vowlh1lzbs4j.cloudfront.net/emomem/";
EmotionalMemory.stimulus = stimulus;
EmotionalMemory.encodeDuration = 3000;

EmotionalMemory.learningInstructionTrial = {
    type: "html-keyboard-response",
    stimulus: learning_instruction_html,
    choices: [" "],
};

EmotionalMemory.learningEncodingTrial = imagePath => ({
    type: "image-keyboard-response",
    stimulus: EmotionalMemory.imageBucket + imagePath,
    choices: jsPsych.NO_KEYS,
    trial_duration: EmotionalMemory.encodeDuration,
    css_classes: ["emo-mem-stimulus"],
});

EmotionalMemory.learningRatingTrial = imagePath => ({
    type: "html-keyboard-response",
    stimulus: learning_prompt_html,
    choices: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "x"],
    data: {
        imagePath,
        isRelevant: true,
    },
});

EmotionalMemory.recallLoop = {
    timeline: [
        {
            type: "survey-text",
            preamble: recall_instruction_html,
            questions: [{ prompt: "" }],
            data: { isRelevant: true },
        },
        {
            type: "html-button-response",
            stimulus: "",
            choices: [
                "Describe another image",
                "Stop describing",
            ],
        },
    ],
    loop_function: data => {
        const [trialData] = data.filter({trial_type: "html-button-response"}).values().slice(-1);
        return trialData.response === 0;
    }
};


if (window.location.href.includes(EmotionalMemory.taskName)) {
    const queryParams = new URLSearchParams(window.location.search.substring(1));
    const setNum = parseInt(queryParams.get("setNum")) || 4;
    jsPsych.init({
        timeline: (new EmotionalMemory(setNum)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
