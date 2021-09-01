import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-button-response.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-multi-choice.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-survey-multi-choice-patch.css";
import "./style.css";
import instruction_html from "./frag/instruction.html";

export class Dass {

    getTimeline() {
        return [this.constructor.questionnaire];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

Dass.taskName = "dass";

Dass.labels = [
    "NEVER",
    "SOMETIMES",
    "OFTEN",
    "ALMOST ALWAYS"
];

Dass.question = prompt => ({
    prompt: prompt,
    options: Dass.labels,
    required: true
});

Dass.statements = [
    "I found it hard to wind down",
    "I was aware of dryness of my mouth",
    "I couldn't seem to experience any positive feeling at all",
    "I experienced breathing difficulty (e.g. excessively rapid breathing, breathlessness in the absence of physical exertion)",
    "I found it difficult to work up the initiative to do things",
    "I tended to over-react to situations",
    "I experienced trembling (e.g., in the hands)",
    "I felt that I was using a lot of nervous energy",
    "I was worried about situations in which I might panic and make a fool of myself",
    "I felt that I had nothing to look forward to",
    "I found myself getting agitated",
    "I found it difficult to relax",
    "I felt down-hearted and blue",
    "I was intolerant of anything that kept me from getting on with what I was doing",
    "I felt I was close to panic",
    "I was unable to become enthusiastic about anything",
    "I felt I wasn't worth much as a person",
    "I felt that I was rather touchy",
    "I was aware of the action of my heart in the absence of physical exertion (e.g., sense of heart rate increase, heart missing a beat)",
    "I felt scared without any good reason",
    "I felt that life was meaningless"
];

Dass.questionnaire = {
    type: "survey-multi-choice",
    preamble: instruction_html,
    questions: Dass.statements.map(Dass.question),
    data: { isRelevant: true, questions: Dass.statements }
}

if (window.location.href.includes(Dass.taskName)) {
    jsPsych.init({
        timeline: (new Dass()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}


