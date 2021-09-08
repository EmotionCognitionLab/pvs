import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "js/jspsych-spatial-orientation.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-spatial-orientation.css";
import "css/common.css";
import scene_img from "./scene.png";
import stimulus from "./stim.json";
// fragments
import instruction_html from "./frag/instruction.html";
import sample_instruction_html from "./frag/sample_instruction.html";
import practice_instruction_html from "./frag/practice_instruction.html";
import test_instruction_html from "./frag/test_instruction.html";

export class SpatialOrientation {
    constructor(setNum) {
        if (Number.isInteger(setNum) && setNum > 0) {
            this.setNum = setNum
        } else {
            throw new Error("setNum must be a strictly positive integer");
        }
    }

    getTimeline() {
        const i = this.constructor.simpleInstruction;
        const t = this.constructor.trial;
        const stimulus = this.constructor.stimulus;
        // example
        const [exampleTrialStim] = stimulus.example.example["0"].trials;
        const exampleBlock = [
            t(exampleTrialStim.center, exampleTrialStim.facing, exampleTrialStim.target, "example", sample_instruction_html),
        ];
        // practice
        const practiceSet = stimulus.practice.practice["0"];
        const practiceStim = (
            practiceSet.order === "random" ?
            jsPsych.randomization.shuffle(practiceSet.trials) :
            practiceSet.trials
        );
        const practiceBlock = [
            i(practice_instruction_html),
            ...practiceStim.map(s => t(s.center, s.facing, s.target, "practice")),
        ];
        // test
        const testSet = stimulus.pre.main[String(this.setNum)];
        const testStim = (
            testSet.order === "random" ?
            jsPsych.randomization.shuffle(testSet.trials) :
            testSet.trials
        );
        const testBlock = [
            i(test_instruction_html),
            ...testStim.map(s => t(s.center, s.facing, s.target, "test")),
        ];
        // timeline
        return [
            i(instruction_html),
            ...exampleBlock,
            ...(this.setNum === 1 ? practiceBlock : []),
            ...testBlock,
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

SpatialOrientation.simpleInstruction = stimulus => ({
    type: "html-keyboard-response",
    stimulus: stimulus,
    choices: [" "],
});

SpatialOrientation.trial = (center, facing, target, mode, instruction = null) => ({
    type: "spatial-orientation",
    scene: `<img src=${scene_img}>`,
    mode: mode,
    instruction: (
        instruction !== null ?
        instruction :
        `Imagine you are standing at the <strong>${center}</strong> and facing the <strong>${facing}</strong>. Point to the <strong>${target}</strong>.`
    ),
    centerText: center,
    topText: facing,
    pointerText: target,
    targetRadians: jsPsych.plugins["spatial-orientation"].angleABC(
        SpatialOrientation.scenePositions[facing],
        SpatialOrientation.scenePositions[center],
        SpatialOrientation.scenePositions[target],
    ),
    data: { isRelevant: mode === "test" },
});


if (window.location.href.includes(SpatialOrientation.taskName)) {
    jsPsych.init({
        timeline: (new SpatialOrientation(1)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); },
    });
}
