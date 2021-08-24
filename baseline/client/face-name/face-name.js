import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import practice_introduction_html from "./frag/practice-introduction.html";
import regular_introduction_html from "./frag/regular-introduction.html";
import instr1_html from "./frag/instr1.html";
import single_set_recall_html from "./frag/single-set-recall.html";
import multi_set_recall_html from "./frag/multi-set-recall.html";
import all_set_recall_html from "./frag/all-set-recall.html";
import instr3_html from "./frag/instr3.html";
import completion_html from "./frag/completion.html";
import stimuli from "./stimuli.json";


export class FaceName {
    constructor(setNum) {
        this.setNum = setNum;
    }

    getTimeline() {
        const timeline = [];
        let recallIntro;

        switch(this.setNum) {
            case 1:
            case 7:
                const practiceVars = this.getTimelineVariables(true, false);
                const practiceLearning = {
                    timeline: [this.constructor.learningStimulus(true)],
                    timeline_variables: practiceVars
                }
                const practiceRecall = {
                    timeline: [this.constructor.recallStimulus(true)],
                    timeline_variables: practiceVars
                }
                timeline.push(this.constructor.instruction(practice_introduction_html));
                timeline.push(this.constructor.instruction(instr1_html));
                timeline.push(practiceLearning);
                timeline.push(practiceLearning);
                timeline.push(this.constructor.instruction(single_set_recall_html));
                timeline.push(practiceRecall);
                recallIntro = single_set_recall_html;
                break;
            case 6:
            case 12:
                timeline.push(this.constructor.instruction(regular_introduction_html));
                recallIntro = all_set_recall_html;
                break;
            default:
                timeline.push(this.constructor.instruction(regular_introduction_html));
                recallIntro = multi_set_recall_html;
                break;
        }

        const learningVars = this.getTimelineVariables(false, false);
        const actualLearning = {
            timeline: [this.constructor.learningStimulus(false)],
            timeline_variables: learningVars
        };
        const recallVars = this.getTimelineVariables(false, true);
        const actualRecall = {
            timeline: [this.constructor.recallStimulus(false)],
            timeline_variables: recallVars
        }

        return timeline.concat([
            this.constructor.instruction(instr3_html),
            actualLearning, actualLearning, this.constructor.instruction(recallIntro), actualRecall,
            this.constructor.instruction(completion_html)
        ]);
        

    }

    getTimelineVariables(isPractice, isRecall) {
        let setStimuli;
        if (isPractice) {
            setStimuli = stimuli.Practice;
        } else {
            const setKey = "Set" + this.setNum;
            setStimuli = stimuli[setKey];
            if (isRecall) {
                switch (this.setNum) {
                    case 1:
                    case 7:
                        break; // no extra recall stimuli for sets 1 and 7
                    case 6:
                    case 12:
                        // sets 6 and 12 show five previous sets + current set in recall
                        for (let i=this.setNum - 5; i<this.setNum; i++) {
                            const prevSetKey = "Set" + i;
                            setStimuli = setStimuli.concat(stimuli[prevSetKey]);
                        }
                        break;
                    default:
                        // other sets show previous set + current set in recall
                        const prevSetKey = "Set" + (this.setNum - 1);
                        setStimuli = setStimuli.concat(stimuli[prevSetKey]);
                        break;
                }
            }
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
        timeline: (new FaceName(1)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
