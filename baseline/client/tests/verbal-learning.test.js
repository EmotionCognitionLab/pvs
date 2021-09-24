require("@adp-psych/jspsych/jspsych.js");
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";
import { clickContinue } from "./utils.js";

describe("verbal-learning", () => {
    it("results should have at least one result marked isRelevant", () => {
        const timeline = [
            {timeline: new VerbalLearning(1, 1, () => 0).getTimeline()},
            {timeline: new VerbalLearning(1, 2, () => Date.now()).getTimeline()},
        ];
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
        expect(timelineHasRelevantData(timeline)).toBe(true);

        // TODO find a way to mock the audio-keyboard-response plugin
        // so that the below doesn't complain about failure to load audio files
        // let timeline = (new VerbalLearning()).getTimeline();
        // // drop the preload step - jest doesn't play nicely with it
        // timeline = timeline.slice(1);
        // expect(timeline.length).toBe(40);
        // jsPsych.init({timeline: timeline});

        // for (let i = 0; i < timeline.length; i++) {
        //     const trial = jsPsych.currentTrial();
        //     if (trial.type === 'html-button-response')  {
        //         clickContinue();
        //     } else if (trial.type === 'memory-field') {
        //         clickContinue("#jspsych-memory-field-button")
        //     } else if (trial.type === 'audio-keyboard-response') {
        //         jsPsych.finishTrial();
        //     } else {
        //         console.error(trial);
        //         throw new Error(`Unexpected trial type '${trial.type}'.`);
        //     }
        // }

        // // check the data
        // const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        // expect(relevantData.length).toBeGreaterThan(0);
    });
});