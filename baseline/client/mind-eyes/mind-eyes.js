import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import introduction_html from "./frag/introduction.html";
import instruction_html from "./frag/instructions.html";
import stimuli from "./stimuli.json";
import glossary from "./glossary.json";
import "./style.css"

export class MindEyes {
    constructor(setNum) {
        this.setNum = setNum;
    }

    get taskName() {
        return this.constructor.taskName;
    }

    getTimeline() {
        let result = [
            this.constructor.instruction(introduction_html),
            this.constructor.instruction(instruction_html)
        ];
        if (this.setNum === 1) {
            result = result.concat([{
                timeline: [this.constructor.stimulus(true)],
                timeline_variables: this.getTimelineVariables(true)
            }]);
        }
        result = result.concat([{
            timeline: [this.constructor.stimulus(false)],
            timeline_variables: this.getTimelineVariables(false)
        }]);
        return result;
    }

    getTimelineVariables(isPractice) {
        const setKey = "Set" + this.setNum;
        const result = isPractice ? stimuli["Practice"] : stimuli[setKey];
        return jsPsych.randomization.shuffle(result.map(r => {
            r.picURL = this.constructor.imageBucket + r.pic + ".jpg";

            return r;
        }));
    }
}

MindEyes.taskName = "mind-eyes";

MindEyes.imageBucket = "https://d3vowlh1lzbs4j.cloudfront.net/eye/";

MindEyes.instruction = (html) => {
    return {
        type: "html-keyboard-response",
        stimulus: html,
        choices: [" "]
    }
}

MindEyes.stimulus = function(isPractice) {
    const result = {
        type: "html-keyboard-response",
        stimulus: function() {
            const words = jsPsych.timelineVariable("words");
            const wordsHtml = words.map( (w, idx) => {
                const glossaryInfo = glossary[w.toUpperCase()];
                let definition;
                let usage;
                if (glossaryInfo === undefined) {
                    definition = "Word not found";
                    usage = "";
                } else {
                    definition = glossaryInfo.definition;
                    usage = glossaryInfo.usage;
                }
                const wordSide = idx % 2 === 0 ? "left" : "right";
                const tipPos = idx < 2 ? "bottom" : "top";
                return `<span class="${wordSide} tooltip">${idx+1}. ${w} <span class="tooltiptext ${tipPos}">${definition}<hr/>${usage}</span></span>`;
            })
            
            
            return `<div class="words">${wordsHtml[0]}${wordsHtml[1]}</div><img src="${jsPsych.timelineVariable("picURL")}"/><div class="words">${wordsHtml[2]}${wordsHtml[3]}</div>`
        },
        choices: ["1", "2", "3", "4"],
        data: {
            words: jsPsych.timelineVariable("words"),
            pic: jsPsych.timelineVariable("pic"),
            isRelevant: true,
        }
    }

    if (isPractice) {
        result.data.isPractice = true
    }

    return result;
}

if (window.location.href.includes(MindEyes.taskName)) {
    console.log((new MindEyes(1)).getTimeline());
    jsPsych.init({
        timeline: (new MindEyes(1)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}