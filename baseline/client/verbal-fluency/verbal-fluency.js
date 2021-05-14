import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-timed-writing.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-timed-writing.css";

const test = {
    type: "timed-writing",
    duration: 60000,
    stimulus: "uwu",
    textarea_rows: 6,
    textarea_cols: 60,
};

jsPsych.init({
    timeline: [
        test,
    ],
    on_finish: () => { jsPsych.data.displayData("json"); },
});
