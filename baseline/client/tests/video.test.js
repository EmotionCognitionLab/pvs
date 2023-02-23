require("@adp-psych/jspsych/jspsych.js");
import { Video } from "../video/video.js";
import { clickContinue } from "./utils";

describe.each([1, 6])("video results for set %i", (setNum) => {
    it("should have one result marked isRelevant", () => {
        const timeline = (new Video(setNum)).getTimeline();
        expect(timeline.length).toBe(1);
        jsPsych.init({timeline: timeline});

        clickContinue();
        
        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });
});
