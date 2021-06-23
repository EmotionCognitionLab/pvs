'use strict'; 

import "@adp-psych/jspsych/jspsych.js";
import * as vf from "../verbal-fluency/verbal-fluency.js";
import * as mp from "../mood-prediction/mood-prediction.js";

const experimentSet1 = [mp, vf];
const allTimelines = [];

for (const exp of experimentSet1) {
    const node = {
        on_timeline_start: () => { console.log(`Starting experiment ${exp.name}`); },
        timeline: exp.timeline,
        on_timeline_finish: (data) => {
            console.log(`Ending experiment ${exp.name}. We would save these results to the db here.`);
            console.log(jsPsych.data.getLastTimelineData().json());
        }
    }
    allTimelines.push(node);
}

jsPsych.init({
    timeline: allTimelines,
    on_finish: () => { jsPsych.data.displayData("json"); },
});
