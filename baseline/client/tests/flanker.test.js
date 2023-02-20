require("@adp-psych/jspsych/jspsych.js");
import instruction6_html from "../flanker/frag/instruction-6.html";
import { Flanker } from "../flanker/flanker.js";
import { pressKey } from "./utils.js";

beforeEach(() => {
    jest.useFakeTimers("legacy");
});

afterEach(() => {
    jest.useRealTimers();
});

describe("flanker", () => {
    const setNum = 5;

    beforeEach(() => {
        let timeline = (new Flanker(setNum)).getTimeline();
        // drop the preload; the test env doesn't get past it
        timeline = timeline.slice(1);
        expect(timeline.length).toBeGreaterThanOrEqual(2);

        jsPsych.init({timeline: timeline});
    });

    it("results should have at least one result marked isRelevant", () => {
        doMainInstructions();
        doMainTrial();
        
        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBeGreaterThanOrEqual(1);
    });

    it("results include the set number", () => {
        doMainInstructions();
        doMainTrial();
        
        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBeGreaterThanOrEqual(1);
        expect(relevantData[0].set).toEqual(setNum);
    });

    it("results include whether or not the trial is congruent", () => {
        doMainInstructions();
        doMainTrial();
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBeGreaterThanOrEqual(1);
        const result = relevantData[0];
        expect(result).toHaveProperty("congruent");
        expect(result.congruent).toBe(result.arrows[2] === result.arrows[1]);
    });

    it("results include the trial duration, which should be between 240 and 3480 ms", () => {
        doMainInstructions();
        doMainTrial();
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBeGreaterThanOrEqual(1);
        const result = relevantData[0];
        expect(result).toHaveProperty("trial_duration");
        expect(result.trial_duration).toBeGreaterThanOrEqual(240);
        expect(result.trial_duration).toBeLessThanOrEqual(3480);
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
        expect(data.length).toBe(2);
        expect(data[1].stimulus).toMatch(/.*\+.*/); // the fixation cross is a plus sign
    });

    it("shows the participant a red screen if they don't respond in time", () => {
        doMainInstructions();
        // fixation 1 -> trial 1
        jest.advanceTimersByTime(800);
        // trial 1 -> feedback 1 without responding to trial
        jest.advanceTimersByTime(1100);
        expect(document.body.classList.contains("flanker-miss")).toBe(true);
        // feedback 1 -> fixation 2
        jest.advanceTimersByTime(800);
        expect(document.body.classList.contains("flanker-miss")).toBe(false);
    });

    it("increases the response time limit by 270 ms in the first six blocks if they get < 13 out of 16 trials correct", () => {
        let blockNum;
        doMainInstructions();
        for(blockNum = 0; blockNum < 6; blockNum++) {
            for(let trialNum = 0; trialNum < 16; trialNum++) {
                doMainTrial();
            }
        }
        // now check what the response time limit was 
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        const result = relevantData[relevantData.length - 1];
        expect(result).toHaveProperty("trial_duration");
        expect(result.trial_duration).toBe(Flanker.defaultResponseTimeLimitMs + ((blockNum - 1) * 270));
    });

    it("increases the response time limit by 90 ms in the seventh and following blocks if they get < 13 out of 16 trials correct", () => {
        let blockNum;
        doMainInstructions();
        for(blockNum = 0; blockNum < 8; blockNum++) {
            for(let trialNum = 0; trialNum < 16; trialNum++) {
                doMainTrial();
            }
        }
        // now check what the response time limit was 
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        const result = relevantData[relevantData.length - 1];
        expect(result).toHaveProperty("trial_duration");
        expect(result.trial_duration).toBe(Flanker.defaultResponseTimeLimitMs + (6 * 270) + ((blockNum - 7) * 90));
    });

    it("randomizes the order of the trials in each block", () => {
        doMainInstructions();
        for (let blockNum = 0; blockNum < 2; blockNum++) {
            for (let trialNum = 0; trialNum < 16; trialNum++) {
                doMainTrial();
            }
        }
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        const block1Stimuli = relevantData.slice(0, 16).map(r => r.arrows);
        const block2Stimuli = relevantData.slice(16).map(r => r.arrows);
        expect(block1Stimuli.length).toEqual(block2Stimuli.length);
        let stimuliMatch = true;
        let i = 0;
        while (stimuliMatch && i < block1Stimuli.length) {
            stimuliMatch = block1Stimuli[i] == block2Stimuli[i];
            i++;
        }
        expect(stimuliMatch).toBe(false);
    });
});

describe("flanker with controlled randomization", () => {
    let randomizationSpy;

    beforeEach(() => {
        let timeline = (new Flanker(5)).getTimeline();
        // drop the preload; the test env doesn't get past it
        timeline = timeline.slice(1);
        // make sure that jsPsych's randomize_order feature doesn't randomze the order
        randomizationSpy = jest.spyOn(jsPsych.randomization, "shuffle").mockImplementation((order) => order);
        jsPsych.init({timeline: timeline});
    });

    afterEach(() => {
        randomizationSpy.mockRestore();
    });

    it("decreases the response time by 90ms in the first six blocks if they get >=13 out of 16 trials correct", () => {
        // this test depends on the order of Flanker.main_stimuli to be right, left, right, left * 4
        doMainInstructions();
        let blockNum;
        for (blockNum = 0; blockNum < 6; blockNum++) {
            for (let trialGroup = 0; trialGroup < 4; trialGroup++) {
                doMainTrial("ArrowRight");
                doMainTrial("ArrowLeft");
                doMainTrial("ArrowRight");
                doMainTrial("ArrowLeft");
            }
        }
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        const result = relevantData[relevantData.length - 1];
        expect(result).toHaveProperty("trial_duration");
        expect(result.trial_duration).toBe(Flanker.defaultResponseTimeLimitMs - ((blockNum - 1) * 90));
    });

    it("decreases the response time by 30ms in the seventh and following blocks if they get >=13 out of 16 trials correct", () => {
        // this test depends on the order of Flanker.main_stimuli to be right, left, right, left * 4
        doMainInstructions();
        let blockNum;
        for (blockNum = 0; blockNum < 8; blockNum++) {
            for (let trialGroup = 0; trialGroup < 4; trialGroup++) {
                doMainTrial("ArrowRight");
                doMainTrial("ArrowLeft");
                doMainTrial("ArrowRight");
                doMainTrial("ArrowLeft");
            }
        }
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        const result = relevantData[relevantData.length - 1];
        expect(result).toHaveProperty("trial_duration");
        expect(result.trial_duration).toBe(Flanker.defaultResponseTimeLimitMs - (6 * 90) - ((blockNum - 7) * 30));
    });
});

it("displays 9 blocks of 16 trials each", () => {
    const expFinishedMock = jest.fn(() => null);
    let timeline = (new Flanker(5)).getTimeline();
    // drop the preload; the test env doesn't get past it
    timeline = timeline.slice(1);

    jsPsych.init({timeline: timeline, on_finish: expFinishedMock});
    doMainInstructions();
    for (let i=0; i < 9 * 16; i++) {
        doMainTrial();
    }
    // finished screen -> all done
    pressKey(" ");
    expect(expFinishedMock).toHaveBeenCalled();
    const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
    expect(relevantData.length).toBe(9 * 16);
});


describe("flanker training", () => {
    beforeEach(() => {
        let timeline = (new Flanker(randomTrainingSetNum())).getTimeline();
        // drop the preload; the test env doesn't get past it
        timeline = timeline.slice(1);
        expect(timeline.length).toBeGreaterThanOrEqual(7);
        jsPsych.init({timeline: timeline});
    });

    it("has six steps before training trials", () => {
        doTrainingInstructions();
        // check the data
        let relevantData = jsPsych.data.get().filter({isTraining: true}).values();
        expect(relevantData.length).toBe(0);
        doTrainingTrial();
        // check the data
        relevantData = jsPsych.data.get().filter({isTraining: true}).values();
        expect(relevantData.length).toBe(1);

    });

    it("shows a fixation cross for 400-700ms before the stimulus", () => {
        doTrainingInstructions();
        const fixationDelay = setTimeout.mock.calls[0][1];
        expect(fixationDelay).toBeGreaterThanOrEqual(400);
        expect(fixationDelay).toBeLessThanOrEqual(700);
        jest.advanceTimersByTime(800);
        const data = jsPsych.data.get().values();
        expect(data.length).toBe(6);
        expect(data[5].stimulus).toMatch(/.*\+.*/);
    });
    
    it("shows feedback after the participant does a trial", () => {
        doTrainingInstructions();
        doTrainingTrial();
        const feedbackData = jsPsych.data.get().filter([{stimulus: "Correct"}, {stimulus: "Incorrect"}]).values();
        expect(feedbackData.length).toBe(1);
    });

    it("gives the participant 1050 ms to respond to a trial", () => {
        doTrainingInstructions();
        jest.advanceTimersByTime(800);
        expect(setTimeout).toHaveBeenCalledTimes(2);
        const availableResponseTime = setTimeout.mock.calls[1][1];
        expect(availableResponseTime).toBe(1050);
    });

    it("shows the participant a red screen if they don't respond in 1050 ms", () => {
        doTrainingInstructions();
        // fixation 1 -> trial 1
        jest.advanceTimersByTime(800);
        // trial 1 -> feedback 1 without responding to trial
        jest.advanceTimersByTime(1100);
        expect(document.body.classList.contains("flanker-miss")).toBe(true);
        // feedback 1 -> fixation 2
        jest.advanceTimersByTime(800);
        expect(document.body.classList.contains("flanker-miss")).toBe(false);
    });

    it("presents four training trials", () => {
        doTrainingInstructions();
        for (let i=0; i<4; i++) {
            doTrainingTrial();
        }
        const relevantData = jsPsych.data.get().filter({isTraining: true}).values();
        expect(relevantData.length).toBe(4);
    });

    it("shows three comprehension screens if you get fewer than three of the training trials right", () => {
        doTrainingInstructions();
        for (let i=0; i<4; i++) {
            doTrainingTrial();
        }
        doComprehension();
        const relevantData = jsPsych.data.get().filter({isComprehension: true}).values();
        expect(relevantData.length).toBe(3);
    });

    it("loops the training and comprehension until you get three or more training trials right", () => {
        doTrainingInstructions();
        for (let i=0; i<2; i++) {
            for (let j=0; j<4; j++) {
                doTrainingTrial();
            }
            doComprehension();
        }
        
        const comprehensionData = jsPsych.data.get().filter({isComprehension: true}).values();
        expect(comprehensionData.length).toBe(6);

        const trialData = jsPsych.data.get().filter({isTraining: true}).values();
        expect(trialData.length).toBe(8);
    });
});

describe("flanker training with controlled randomization", () => {
    let timeline;
    let randomizationSpy;

    beforeEach(() => {
        timeline = (new Flanker(randomTrainingSetNum())).getTimeline();
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
        
        doTrainingInstructions();
        doTrainingTrial("ArrowRight");
        doTrainingTrial("ArrowLeft");
        doTrainingTrial("ArrowRight");
        doTrainingTrial("ArrowLeft");
        // final instruction screen -> fixation 1
        pressKey(" ");
        // at this point we should have been kicked into a real trial block, skipping comprehension
        // do one trial to be sure
        doTrainingTrial();
        const comprehensionData = jsPsych.data.get().filter({isComprehension: true}).values();
        expect(comprehensionData.length).toBe(0);
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });

    it("shows a final instructional message between the training and the main trials", () => {
        // this test depends on the order of Flanker.training_stimuli to be right, left, right, left
        doTrainingInstructions();
        doTrainingTrial("ArrowRight");
        doTrainingTrial("ArrowLeft");
        doTrainingTrial("ArrowRight");
        doTrainingTrial("ArrowLeft");
        // final instruction screen -> fixation 1
        pressKey(" ");
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.stimulus).toBe(instruction6_html);
    });

    it("randomizes the order of the trial stimuli", () => {
        doTrainingInstructions();
        doTrainingTrial("ArrowRight");
        expect(randomizationSpy).toHaveBeenCalled();
    });

    it("does not count the training trials in set 1 as part of the first block when adjusting the response time", () => {
        // this test depends on the order of Flanker.training_stimuli to be right, left, right, left
        doTrainingInstructions();
        doTrainingTrial("ArrowRight");
        doTrainingTrial("ArrowLeft");
        doTrainingTrial("ArrowRight");
        doTrainingTrial("ArrowLeft");
        // final instruction screen -> fixation 1
        pressKey(" ");
        // go through the first block and make sure response time doesn't change
        for (let i = 0; i < Flanker.mainStimuli.length; i++) {
            doMainTrial();
            const data = jsPsych.data.get().last(1).values()[0];
            expect(data.trial_duration).toBe(Flanker.defaultResponseTimeLimitMs);
        }
    });

});

function randomTrainingSetNum() {
    return Math.random() < 0.5 ? 3 : 9;
}

function doTrainingInstructions() {
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

function doTrainingTrial(arrowKey="ArrowLeft") {
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

function doMainInstructions() {
    // instruction -> fixation 1
    pressKey(" ");
}

function doMainTrial(arrowKey="ArrowLeft") {
    // fixation 1 -> trial 1
    jest.advanceTimersByTime(800);
    // trial 1 -> fixation 2
    pressKey(arrowKey);
}
