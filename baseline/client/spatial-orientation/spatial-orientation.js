import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-spatial-orientation.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import scene_img from "./scene.png";


export class SpatialOrientation {
    getTimeline() {
        return [
            {
                type: "spatial-orientation",
                scene: `<img src=${scene_img}>`,
            },
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
