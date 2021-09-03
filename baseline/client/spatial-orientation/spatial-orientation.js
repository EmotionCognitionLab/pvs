import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-spatial-orientation.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import scene_img from "./scene.png";
import stimulus from "./stim.json";

export class SpatialOrientation {
    getTimeline() {
        return [
            {
                type: "spatial-orientation",
                scene: `<img src=${scene_img}>`,
                centerText: "bell",
                topText: "tree",
                pointerText: "drum",
                targetRadians: jsPsych.plugins["spatial-orientation"].angleABC(
                    SpatialOrientation.scenePositions.tree,
                    SpatialOrientation.scenePositions.bell,
                    SpatialOrientation.scenePositions.drum,
                ),
            },
        ];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

SpatialOrientation.taskName = "spatial-orientation";

SpatialOrientation.stimulus = stimulus;

SpatialOrientation.scenePositions = {
    "trash can": [0, 0],
    "traffic light": [105, 85],
    wheel: [232, 130],
    drum: [187, -12],
    bell: [108, -149],
    barrel: [395, 78],
    tree: [342, -129],
}


if (window.location.href.includes(SpatialOrientation.taskName)) {
    jsPsych.init({
        timeline: (new SpatialOrientation()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
