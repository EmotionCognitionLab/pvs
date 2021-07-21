require("@adp-psych/jspsych/jspsych.js");
import { Flanker } from "../flanker/flanker.js";
import { pressKey } from "./utils.js"

describe("flanker", () => {
    it("results should have at least one result marked isRelevant", () => {
        let timeline = (new Flanker(3)).getTimeline();
        // drop the preload; the test env doesn't get past it
        timeline = timeline.slice(1);
        expect(timeline.length).toBe(6);
        jsPsych.init({timeline: timeline});

        // welcome screen -> instruction
        pressKey(" ");
        // instruction screen -> trial
        pressKey(" ");
        // first trial
        pressKey("f");
        // second trial
        pressKey("f");
        // third trial
        pressKey("f");

        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(3);
    });
});