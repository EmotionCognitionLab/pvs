import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/plugins/jspsych-image-keyboard-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import introduction_html from "./frag/introduction.html";
import practice_instructions_html from "./frag/practice_instructions.html";
import recall_instructions_html from "./frag/recall_instructions.html";
import actual_instructions_html from "./frag/actual_instructions.html";
import completion_html from "./frag/completion.html";
import stimuli from "./stimuli.json";
import "./style.css"

export class PatternSeparation {
    constructor(setNum, isRecall) {
        this.setNum = setNum;
        this.isRecall = isRecall;
    }

    get taskName() {
        return this.constructor.taskName;
    }

    getLearningTimeline() {
        const practiceLearningVariables = this.getTimelineVariables(true);
        const actualLearningVariables = this.getTimelineVariables(false);
        const practiceRecallVariables = this.getTimelineVariables(true);

        return [
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
        ]
    }

    getRecallTimeline() {
        const actualRecallVariables = this.getTimelineVariables(false)
        
        return [
            this.constructor.instruction(recall_instructions_html),
            {
                timeline: [this.constructor.recallStimulus(false)],
                timeline_variables: actualRecallVariables
            },
            this.constructor.instruction(completion_html)
        ]
    }

    getTimeline() {
        if (this.isRecall) return this.getRecallTimeline();
        return this.getLearningTimeline();
    }

    getTimelineVariables(isPractice) {
        let stims;
        if (isPractice) {
            stims = stimuli["Practice"];
        } else {
            const setKey = "Set" + this.setNum;
            stims = stimuli[setKey];
        }
        
        stims.forEach(s => s.picUrl = this.constructor.imageBucket + s.pic);
        stims = jsPsych.randomization.shuffle(stims);
        if (this.isRecall) return stims;
        return stims.filter(s => s["type"] === "Target");
    }
}

PatternSeparation.taskName = "pattern-separation";

PatternSeparation.imageBucket = "https://dfi38xt52pdd.cloudfront.net/";

PatternSeparation.instruction = (html) => {
    return {
        type: "html-keyboard-response",
        stimulus: html,
        choices: [" "]
    }
}

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
    }
    if (isPractice) {
        result.data.isPractice = true;
    }
    return result; 
}

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
    }
    if (isPractice) {
        result.data.isPractice = true;
    }
    return result;
}

PatternSeparation.answerFasterStimulus = {
    type: "html-keyboard-response",
    stimulus: "Answer faster next time",
    choices: jsPsych.NO_KEYS,
    trial_duration: 800,
}

PatternSeparation.answerFasterNode = {
    timeline: [PatternSeparation.answerFasterStimulus],
    conditional_function: function() {
        return jsPsych.data.get().last(1).values()[0].response === null;
    }
}

if (window.location.href.includes(PatternSeparation.taskName)) {
    jsPsych.init({
        timeline: (new PatternSeparation(1, false)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}