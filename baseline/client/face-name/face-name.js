import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import introduction_html from "./frag/introduction.html";
import instr1_html from "./frag/instr1.html";
import instr2_html from "./frag/instr2.html";
import instr3_html from "./frag/instr3.html";
import stimuli from "./stimuli.json";


export class FaceName {
    constructor(setNum, prevResults) {
        this.setNum = setNum;
        this.prevResults = prevResults;
    }

    getTimeline() {
        if (this.setNum === 1) {
            const practiceVars = this.getTimelineVariables(true);
            const practiceLearning = {
                timeline: [this.constructor.learningStimulus(true)],
                timeline_variables: practiceVars
            }
            const practiceRecall = {
                timeline: [this.constructor.recallStimulus(true)],
                timeline_variables: practiceVars
            }
            const actualVars = this.getTimelineVariables(false);
            const actualLearning = {
                timeline: [this.constructor.learningStimulus(false)],
                timeline_variables: actualVars
            };
            const actualRecall = {
                timeline: [this.constructor.recallStimulus(false)],
                timeline_variables: jsPsych.randomization.shuffle(actualVars)
            }
            return [
                this.constructor.instruction(introduction_html),
                this.constructor.instruction(instr1_html),
                practiceLearning, practiceLearning,
                this.constructor.instruction(instr2_html),
                practiceRecall,
                this.constructor.instruction(instr3_html),
                actualLearning, actualLearning, actualRecall
            ];
        }

    }

    getTimelineVariables(isPractice) {
        let setStimuli;
        if (isPractice) {
            setStimuli = stimuli.Practice;
        } else {
            const setKey = "Set" + this.setNum;
            setStimuli = stimuli[setKey];
        }

        return jsPsych.randomization.shuffle(
            setStimuli.map(i => {
                i.picUrl = FaceName.imageBucket + i.picId;
                i.names = jsPsych.randomization.shuffle([i.name, i.lure]);
                return i;
            })
        );
    }
}

FaceName.taskName = "face-name";

FaceName.imageBucket = "https://drtmnva0tpafc.cloudfront.net/";

FaceName.instruction = (html) => {
    return {
        type: "html-keyboard-response",
        stimulus: html,
        choices: [" "]
    }
}

FaceName.learningStimulus = (isPractice=false) => {
    const result = {
        type: "html-keyboard-response",
        stimulus: function() { return `<img src="${jsPsych.timelineVariable('picUrl')}"/> <br/> ${jsPsych.timelineVariable('name')}` },
        choices: [" "],
        data: {
            cat: jsPsych.timelineVariable('cat'),
            name: jsPsych.timelineVariable('name'),
            picId: jsPsych.timelineVariable('picId'),
            isLearning: true
        }
    }
    if (isPractice) {
        result.data.isPractice = true;
    }
    return result; 
}

FaceName.recallStimulus = (isPractice=false) => {
    const result = {
        type: "html-keyboard-response",
        stimulus: function() { return `<img src="${jsPsych.timelineVariable('picUrl')}"/> <br/> 1. ${jsPsych.timelineVariable('names')[0]} 2. ${jsPsych.timelineVariable('names')[1]}` },
        choices: ["1", "2"],
        data: {
            cat: jsPsych.timelineVariable('cat'),
            name: jsPsych.timelineVariable('name'),
            picId: jsPsych.timelineVariable('picId'),
            lure: jsPsych.timelineVariable('lure'),
            names: jsPsych.timelineVariable('names'),
            isRelevant: true,
            isRecall: true
        },
        on_finish: function(data) {
            const response = Number.parseInt(data.response);
            const selectedName = data.names[response - 1];
            data.correct = selectedName === data.name;
        }
    }
    if (isPractice) {
        result.data.isPractice = true;
    } else {
        result.data.isLearning = true;
    }
    return result; 
}

if (window.location.href.includes(FaceName.taskName)) {
    jsPsych.init({
        timeline: (new FaceName(1, [])).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
