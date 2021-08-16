import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-spatial-orientation.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";

export class SpatialOrientation {
    getTimeline() {
        return [
            {type: "spatial-orientation"},
        ];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

SpatialOrientation.taskName = "spatial-orientation";


if (window.location.href.includes(SpatialOrientation.taskName)) {
    jsPsych.init({
        timeline: (new SpatialOrientation()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
