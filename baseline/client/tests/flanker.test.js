require("@adp-psych/jspsych/jspsych.js");
import { Flanker } from "../flanker/flanker.js";
import { pressKey } from "./utils.js"

beforeEach(() => {
    jest.useFakeTimers("legacy");
});

afterEach(() => {
    jest.useRealTimers();
});

describe("flanker", () => {
    beforeEach(() => {
        let timeline = (new Flanker(3)).getTimeline();
        // drop the preload; the test env doesn't get past it
        timeline = timeline.slice(1);
        expect(timeline.length).toBeGreaterThanOrEqual(3);

        jsPsych.init({timeline: timeline});
    });

    it("results should have at least one result marked isRelevant", () => {
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

    it("shows a fixation cross for 400-700ms before the stimulus", () => {
        // welcome screen -> instruction
        pressKey(" ");
        // instruction -> fixation 1
        pressKey(" ");
        const fixationDelay = setTimeout.mock.calls[0][1];
        expect(fixationDelay).toBeGreaterThanOrEqual(400);
        expect(fixationDelay).toBeLessThanOrEqual(700);
        jest.advanceTimersByTime(800);
        const data = jsPsych.data.get().values();
        expect(data.length).toBe(3);
        expect(data[2].stimulus).toMatch(/.*\+.*/);
    });

});

describe("flanker training", () => {
    beforeEach(() => {
        let timeline = (new Flanker(1)).getTimeline();
        // drop the preload; the test env doesn't get past it
        timeline = timeline.slice(1);
        expect(timeline.length).toBeGreaterThanOrEqual(7);
        jsPsych.init({timeline: timeline});
    });

    it("has six steps before training trials", () => {
        doInstructions();
        // check the data
        let relevantData = jsPsych.data.get().filter({isTrial: true}).values();
        expect(relevantData.length).toBe(0);
        doTrial();
        // check the data
        relevantData = jsPsych.data.get().filter({isTrial: true}).values();
        expect(relevantData.length).toBe(1);

    });

    it("shows a fixation cross for 400-700ms before the stimulus", () => {
        doInstructions();
        const fixationDelay = setTimeout.mock.calls[0][1];
        expect(fixationDelay).toBeGreaterThanOrEqual(400);
        expect(fixationDelay).toBeLessThanOrEqual(700);
        jest.advanceTimersByTime(800);
        const data = jsPsych.data.get().values();
        expect(data.length).toBe(7);
        expect(data[6].stimulus).toMatch(/.*\+.*/);
    });

    it("shows feedback after the participant does a trial", () => {
        doInstructions();
        doTrial();
        const feedbackData = jsPsych.data.get().filter([{stimulus: "Correct"}, {stimulus: "Incorrect"}]).values();
        expect(feedbackData.length).toBe(1);
    });

    it("gives the participant 1050 ms to respond to a trial", () => {
        doInstructions();
        jest.advanceTimersByTime(800);
        expect(setTimeout).toHaveBeenCalledTimes(2);
        const availableResponseTime = setTimeout.mock.calls[1][1];
        expect(availableResponseTime).toBe(1050);
    });

    it("tells the participant to answer faster if they don't respond in 1050 ms", () => {
        doInstructions();
        // fixation 1 -> trial 1
        jest.advanceTimersByTime(800);
        // trial 1 -> feedback 1 without responding to trial
        jest.advanceTimersByTime(1100);
        // feedback 1 -> fixation 2
        jest.advanceTimersByTime(800);
        const dataValues = jsPsych.data.get().values();
        const finalValue = dataValues[dataValues.length - 1];
        expect(finalValue.stimulus).toBe("Answer faster next time");
    });

    it("presents four training trials", () => {
        doInstructions();
        for (let i=0; i<4; i++) {
            doTrial();
        }
        const relevantData = jsPsych.data.get().filter({isTrial: true}).values();
        expect(relevantData.length).toBe(4);
    });

    it("shows three comprehension screens if you get feweer than three of the training trials right", () => {
        doInstructions();
        for (let i=0; i<4; i++) {
            doTrial();
        }
        doComprehension();
        const relevantData = jsPsych.data.get().filter({isComprehension: true}).values();
        expect(relevantData.length).toBe(3);
    });

    it("loops the training and comprehension until you get three or more training trials right", () => {
        doInstructions();
        for (let i=0; i<2; i++) {
            for (let j=0; j<4; j++) {
                doTrial();
            }
            doComprehension();
        }
        
        const comprehensionData = jsPsych.data.get().filter({isComprehension: true}).values();
        expect(comprehensionData.length).toBe(6);

        const trialData = jsPsych.data.get().filter({isTrial: true}).values();
        expect(trialData.length).toBe(8);
    });
});

describe("flanker training with controlled randomization", () => {
    let timeline;
    let randomizationSpy;

    beforeEach(() => {
        timeline = (new Flanker(1)).getTimeline();
        // drop the preload; the test env doesn't get past it
        timeline = timeline.slice(1);
        expect(timeline.length).toBeGreaterThanOrEqual(7);
        // make sure that jsPsych's randomize_order feature doesn't randomze the order
        randomizationSpy = jest.spyOn(jsPsych.randomization, "shuffle").mockImplementation((order) => order);
        jsPsych.init({timeline: timeline});
    });

    afterEach(() => {
        randomizationSpy.mockRestore();
    });

    it("does not show the comprehension screens if you get three or more of the training trials right", () => {
        // this test depends on the order of Flanker.training_stimuli to be right, left, right, left
        
        doInstructions();
        doTrial("ArrowRight");
        doTrial("ArrowLeft");
        doTrial("ArrowRight");
        doTrial("ArrowLeft");
        // at this point we should have been kicked into a real trial block, skipping comprehension
        // do one trial to be sure
        doTrial();
        const comprehensionData = jsPsych.data.get().filter({isComprehension: true}).values();
        expect(comprehensionData.length).toBe(0);
    });

    it("randomizes the order of the trial stimuli", () => {
        doInstructions();
        doTrial("ArrowRight");
        expect(randomizationSpy).toHaveBeenCalled();
    });
});

function doInstructions() {
    // welcome screen -> instruction 1
    pressKey(" ");
    // instruction 1 -> instruction 2
    pressKey(" ");
    // instruction 2 -> instruction 3
    pressKey("ArrowLeft");
    // instruction 3 -> instruction 4
    pressKey("ArrowRight");
    // instruction 4 -> instruction 5
    pressKey("ArrowRight");
    //  instruction 5 -> instruction 6
    pressKey(" ");
}

function doTrial(arrowKey="ArrowLeft") {
    // fixation 1 -> trial 1
    jest.advanceTimersByTime(800);
    // trial 1 -> feedback 1
    pressKey(arrowKey);
    // feedback 1 -> fixation 2
    jest.advanceTimersByTime(800);
}

function doComprehension() {
    // comprehension 1 -> comprehension 2
    pressKey("ArrowLeft");
    // comprehension 2 -> comprehension 3
    pressKey("ArrowRight");
    // comprehension 3 -> repeat trial
    pressKey(" ");
}