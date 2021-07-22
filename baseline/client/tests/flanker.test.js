require("@adp-psych/jspsych/jspsych.js");
import { Flanker } from "../flanker/flanker.js";
import { pressKey } from "./utils.js"

afterEach(() => {
    jest.useRealTimers();
});

describe("flanker", () => {
    it("results should have at least one result marked isRelevant", () => {
        jest.useFakeTimers();
        let timeline = (new Flanker(3)).getTimeline();
        // drop the preload; the test env doesn't get past it
        timeline = timeline.slice(1);
        expect(timeline.length).toBeGreaterThanOrEqual(3);

        jsPsych.init({timeline: timeline});

        // welcome screen -> instruction
        pressKey(" ");
        // instruction -> fixation 1
        pressKey(" ");
        // fixation 1 -> trial 1
        jest.advanceTimersByTime(800);
        // trial 1 -> fixation 2
        pressKey("ArrowLeft");
        
        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBeGreaterThanOrEqual(1);
    });
});