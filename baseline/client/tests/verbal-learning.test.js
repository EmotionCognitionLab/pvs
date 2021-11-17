import { VerbalLearning } from "../verbal-learning/verbal-learning.js";
import instruction_check_loop_html from "../verbal-learning/frag/instruction_check_loop.html";
import { pressKey } from "./utils.js";

// mock away annoying plugins with a dummy
const dummyPlugin = {
    info: {name: "dummy", parameters: {}},
    trial: () => { jsPsych.finishTrial({}); },
};
jsPsych.plugins["preload"] = dummyPlugin;
jsPsych.plugins["audio-keyboard-response"] = dummyPlugin;

const completeCurrentTrial = () => {
    const trial = jsPsych.currentTrial();
    const progress = jsPsych.progress();
    if (trial.type === "html-keyboard-response") {
        if (typeof trial.trial_duration === "number") {
            jest.advanceTimersByTime(trial.trial_duration);
        } else {
            pressKey(trial.choices[0]);
        }
    } else if (trial.type === "html-button-response") {
        // click "Sound Worked Fine"
        jsPsych.getDisplayElement().querySelectorAll("button")[1].click();
    } else if (trial.type === "audio-keyboard-response") {
        // audio plugin is mocked to finish trial immediately
    } else if (trial.type === "countdown") {
        jest.advanceTimersByTime(trial.duration);
    } else if (trial.type === "memory-field") {
        document.getElementById("jspsych-memory-field-button").click();
    }
    // assert that progress occurred
    if (jsPsych.progress().current_trial_global <= progress.current_trial_global) {
        console.log(trial);
        throw Error("progress didn't increase");
    }
};

beforeEach(() => {
    jest.useFakeTimers("legacy");
});

afterEach(() => {
    jest.useRealTimers();
});

describe("verbal-learning", () => {
    it("results should have at least one result marked isRelevant", () => {
        // get timelines for segments 1 and 2
        const timeline1 = (new VerbalLearning(1, 1)).getTimeline();
        const timeline2 = (new VerbalLearning(1, 2, () => Date.now())).getTimeline();
        // test timeline nodes for relevant data
        const timelineHasRelevantData = timeline => {
            for (const node of timeline) {
                if (node.timeline === undefined) {
                    // node is a trial, hopefully
                    if (node.data && node.data.isRelevant) {
                        return true;
                    }
                } else {
                    // node is a timeline, hopefully... recurse!
                    if (timelineHasRelevantData(node.timeline)) {
                        return true;
                    }
                }
            }
            return false;
        };
        expect(timelineHasRelevantData(timeline1)).toBe(true);
        expect(timelineHasRelevantData(timeline2)).toBe(true);
        // test recorded data for relevant data
        const recordRelevantDataFromTimeline = timeline => {
            let finished = false;
            jsPsych.init({
                timeline: timeline,
                on_finish: () => { finished = true; },
            });
            for (let trials = 0; !finished; ++trials) {
                if (trials > 100) { throw new Error("too many trials"); }
                completeCurrentTrial();
            }
            return jsPsych.data.get().filter({isRelevant: true}).values();
            expect(relevant.length).toBeGreaterThan(0);
        };
        expect(recordRelevantDataFromTimeline(timeline1).length).toBeGreaterThan(0);
        expect(recordRelevantDataFromTimeline(timeline2).length).toBeGreaterThan(0);
    });
});
