import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-spatial-orientation.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import scene_img from "./scene.png";
// fragments
import instruction_html from "./frag/instruction.html";
import sample_instruction_html from "./frag/sample_instruction.html";
import practice_instruction_html from "./frag/practice_instruction.html";
import test_instruction_html from "./frag/test_instruction.html";

export class SpatialOrientation {
    getTimeline() {
        return [
            {
                type: "spatial-orientation",
                scene: `<img src=${scene_img}>`,
                centerText: "bell",
                topText: "tree",
                pointerText: "drum",
                targetAngle: this.constructor.angleABC(
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

SpatialOrientation.scenePositions = {
    trash: [0, 0],
    traffic: [105, 85],
    wheel: [232, 130],
    drum: [187, -12],
    bell: [108, -149],
    barrel: [395, 78],
    tree: [342, -129],
}

SpatialOrientation.angleABC = ([aX, aY], [bX, bY], [cX, cY]) => {
    const [b2aX, b2aY] = [aX - bX, aY - bY];
    const [b2cX, b2cY] = [cX - bX, cY - bY];
    const dx = (b2cX*b2aX + b2cY*b2aY) / Math.sqrt(b2aX*b2aX + b2aY*b2aY);
    const dy = (b2cY*b2aX - b2cX*b2aY) / Math.sqrt(b2aX*b2aX + b2aY*b2aY);
    return Math.atan2(dy, dx);
};


if (window.location.href.includes(SpatialOrientation.taskName)) {
    jsPsych.init({
        timeline: (new SpatialOrientation()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
