import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/plugins/jspsych-image-keyboard-response.js";
import "@adp-psych/jspsych/plugins/jspsych-preload.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import introduction_html from "./frag/introduction.html";
import practice_instructions_html from "./frag/practice_instructions.html";
import recall_instructions_html from "./frag/recall_instructions.html";
import actual_instructions_html from "./frag/actual_instructions.html";
import stimuli from "./stimuli.json";
import "./style.css";

export class PatternSeparation {
    constructor(setNum, isRecall) {
        this.setNum = setNum;
        this.isRecall = isRecall;
    }

    get taskName() {
        if (this.isRecall) return this.constructor.taskName + "-recall";
        return this.constructor.taskName + "-learning";
    }

    getLearningTimeline() {
        const practiceLearningVariables = this.getTimelineVariables(true);
        const actualLearningVariables = this.getTimelineVariables(false);
        const practiceRecallVariables = this.getTimelineVariables(true, true);
        const images = practiceLearningVariables.concat(actualLearningVariables).concat(practiceRecallVariables).map(lv => lv.picUrl);

        if (this.setNum === 1 || this.setNum === 4) {
            return [
                this.constructor.preload(images),
                this.constructor.instruction(introduction_html),
                this.constructor.instruction(practice_instructions_html),
                { 
                    timeline: [this.constructor.learningStimulus(true, true), this.constructor.answerFasterNode],
                    timeline_variables: practiceLearningVariables
                },
                {
                    timeline: [this.constructor.learningStimulus(false, true), this.constructor.answerFasterNode],
                    timeline_variables: practiceLearningVariables
                },
                this.constructor.instruction(recall_instructions_html),
                {
                    timeline: [this.constructor.recallStimulus(true)],
                    timeline_variables: practiceRecallVariables
                },
                this.constructor.instruction(actual_instructions_html),
                {
                    timeline: [this.constructor.learningStimulus(true, false), this.constructor.answerFasterNode],
                    timeline_variables: actualLearningVariables
                },
                {
                    timeline: [this.constructor.learningStimulus(false, false), this.constructor.answerFasterNode],
                    timeline_variables: actualLearningVariables
                }
            ];
        } else {
            return [
                this.constructor.preload(images),
                this.constructor.instruction(introduction_html),
                this.constructor.instruction(actual_instructions_html),
                {
                    timeline: [this.constructor.learningStimulus(true, false), this.constructor.answerFasterNode],
                    timeline_variables: actualLearningVariables
                },
                {
                    timeline: [this.constructor.learningStimulus(false, false), this.constructor.answerFasterNode],
                    timeline_variables: actualLearningVariables
                }
            ];
        }            
    }

    getRecallTimeline() {
        const actualRecallVariables = this.getTimelineVariables(false);
        const images = actualRecallVariables.map(rv => rv.picUrl);
        
        return [
            this.constructor.preload(images),
            this.constructor.instruction(recall_instructions_html),
            {
                timeline: [this.constructor.recallStimulus(false)],
                timeline_variables: actualRecallVariables
            },
        ];
    }

    getTimeline() {
        if (this.isRecall) return this.getRecallTimeline();
        return this.getLearningTimeline();
    }

    getTimelineVariables(isPractice, isRecall=false) {
        let stims;
        if (isPractice) {
            stims = stimuli["Practice"];
        } else {
            const setKey = "Set" + this.setNum;
            stims = stimuli[setKey];
        }
        
        stims.forEach(s => s.picUrl = this.constructor.imageBucket + s.pic);
        stims = jsPsych.randomization.shuffle(stims);
        if (isRecall || this.isRecall) return stims; // local param overrides instance param
        return stims.filter(s => s["type"] === "Target");
    }
}

PatternSeparation.taskName = "pattern-separation";

PatternSeparation.imageBucket = "https://d3vowlh1lzbs4j.cloudfront.net/pat/";

PatternSeparation.instruction = (html) => {
    return {
        type: "html-keyboard-response",
        stimulus: html,
        choices: [" "]
    };
};

// when isShoebox is true, use the prompt "Will the object fit inside a lady's medium shoe box?"
// when isShoebox is false, use the prompt "Can you carry the object across the room using only your right hand?"
PatternSeparation.learningStimulus = (isShoebox, isPractice=false) => {
    const prompt = isShoebox ? "Will the object fit inside a lady's medium shoe box?" : "Can you carry the object across the room using only your right hand?";
    const result = {
        type: "image-keyboard-response",
        stimulus: jsPsych.timelineVariable('picUrl'),
        choices: ["y", "n"],
        prompt: `<div id="prompt">${prompt}</div><div id="checkmark"></div>`,
        data: {
            type: jsPsych.timelineVariable('type'),
            pic: jsPsych.timelineVariable('pic'),
            isRelevant: true,
            isLearning: true
        },
        response_ends_trial: false,
        trial_duration: 2500,
        render_on_canvas: false,
        stimulus_width: 800,
        maintain_aspect_ratio: true
    };
    if (isPractice) {
        result.data.isPractice = true;
        result.trial_duration = 3000;
    }
    return result; 
};

PatternSeparation.recallStimulus = (isPractice=false) => {
    const result = {
        type: "image-keyboard-response",
        stimulus: jsPsych.timelineVariable('picUrl'),
        choices: ["1", "2", "3", "4"],
        prompt: "<br/>1 = definitely old, 2 = maybe old, 3 = maybe new, or 4 = definitely new",
        data: {
            type: jsPsych.timelineVariable("type"),
            pic: jsPsych.timelineVariable("pic"),
            isRelevant: true,
            isRecall: true
        },
        render_on_canvas: false,
        stimulus_width: 800,
        maintain_aspect_ratio: true
    };
    if (isPractice) {
        result.data.isPractice = true;
    }
    return result;
};

PatternSeparation.answerFasterStimulus = {
    type: "html-keyboard-response",
    stimulus: "Answer faster next time",
    choices: jsPsych.NO_KEYS,
    trial_duration: 800,
};

PatternSeparation.answerFasterNode = {
    timeline: [PatternSeparation.answerFasterStimulus],
    conditional_function: function() {
        return jsPsych.data.get().last(1).values()[0].response === null;
    }
};

PatternSeparation.preload = (images) => {
    return {
        type: "preload",
        images: images
    };
};

if (window.location.href.includes(PatternSeparation.taskName)) {
    const queryParams = new URLSearchParams(window.location.search.substring(1));
    const setNum = parseInt(queryParams.get("setNum")) || 1;
    const isRecall = queryParams.get("isRecall") && queryParams.get("isRecall").toLowerCase() === "true" ? true : false;
    jsPsych.init({
        timeline: (new PatternSeparation(setNum, isRecall)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
