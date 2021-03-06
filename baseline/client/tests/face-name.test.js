require("@adp-psych/jspsych/jspsych.js");
import { FaceName } from "../face-name/face-name.js";
import { pressKey } from "./utils.js";
import stimuli from "../face-name/stimuli.json";


const prompPat = /1. ([a-zA-Z]+)<\/span> <span style="margin-left: 150px;">2. ([a-zA-Z]+)/ ;

function getTimeline(setNum=1) {
    return (new FaceName(setNum)).getTimeline().slice(1); // drop the preload step; doesn't play well in the test env
}

describe("FaceName", () => {
    
    beforeEach(() => {
        jsPsych.init({
            timeline: getTimeline()
        });
        jest.useFakeTimers("legacy");
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("should have at least one result marked isRelevant", () => {
        const data = doFirstRecall(true);
        expect(data.isRelevant).toBeTruthy();
    });

    it("should mark learning trials isLearning", () => {
        doFirstTrainingPrompt();
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.isLearning).toBeTruthy();
    });

    it("should mark recall trials isRecall", () => {
        const data = doFirstRecall(false);
        expect(data.isRecall).toBeTruthy();
    });

    it("should mark practice trials isPractice", () => {
        doFirstTrainingPrompt();
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.isPractice).toBeTruthy();
    });

    it("should mark correct answers correct", () => {
        const data = doFirstRecall(true);
        expect(data.correct).toBeTruthy();
    });

    it("should mark incorrect answers incorrect", () => {
        const data = doFirstRecall(false);
        expect(data.correct).toBeFalsy();
    });

    it("should include the image category in the data", () => {
        for (let i=0; i<2; i++)  { // two instruction screens
            pressKey(" ");
        }
        const category = jsPsych.timelineVariable("cat", true);
        jest.advanceTimersByTime(5000); // first prompt
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.cat).toBe(category);
    });

    it("should include the image id in the data", () => {
        for (let i=0; i<2; i++)  { // two instruction screens
            pressKey(" ");
        }
        const picId = jsPsych.timelineVariable("picId", true);
        jest.advanceTimersByTime(5000); // first prompt
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.picId).toBe(picId);
    });

    it("should include the correct name in the data on learning trials", () => {
        for (let i=0; i<2; i++)  { // two instruction screens
            pressKey(" ");
        }
        const name = jsPsych.timelineVariable("name", true);
        jest.advanceTimersByTime(5000); // first prompt
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.name).toBe(name);
    });

    it("should include the correct name and the lure in the data on recall trials", () => {
        skipTraining();
        const name = jsPsych.timelineVariable("name", true);
        const lure = jsPsych.timelineVariable("lure", true);
        pressKey("1"); // first recall trial
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.name).toBe(name);
        expect(data.lure).toBe(lure);
    });

    it("should show the same four prompts twice in a row as practice in the first set", () => {
        const pictures = [];
        const names = [];
        pressKey(" "); // first instruction screen
        pressKey(" "); // second instruction screen
        for (let i=0; i<8; i++)  {
            pictures.push(jsPsych.getDisplayElement().getElementsByTagName("img")[0].attributes.getNamedItem("src").value);
            const name = jsPsych.getDisplayElement().innerHTML.match(/<br> ([a-zA-Z]+)<\/div>/)[1];
            names.push(name);
            jest.advanceTimersByTime(5000);
        }
        expect(names.slice(0,4)).toStrictEqual(names.slice(4,8));
        expect(pictures.slice(0, 4)).toStrictEqual(pictures.slice(4,8));
    });

    it("should randomize the order of the names shown in a recall prompt", () => {
        const name1 = [];
        const name2 = [];
        const repeatCount = 100;
        for (let j=0; j<repeatCount; j++) {
            jsPsych.init({
                timeline: getTimeline()
            });
            skipTraining();
            const match = jsPsych.getDisplayElement().innerHTML.match(prompPat);
            name1.push(match[1]);
            name2.push(match[2]);
        }
        expect(name1.length).toBe(repeatCount);
        expect(name2.length).toBe(repeatCount);
        const s = new Set(name1);
        expect(s.size).toBe(4);
        s.forEach(entry => {
            const name1Count = name1.filter(item => item === entry).length;
            expect(name1Count).toBeGreaterThanOrEqual(15);
            expect(name1Count).toBeLessThanOrEqual(34);
            const name2Count = name2.filter(item => item === entry).length;
            expect(name2Count).toBeGreaterThanOrEqual(15);
            expect(name2Count).toBeLessThanOrEqual(34);
        });
    });

    it("should show the recall prompts in a different order than the learning prompts", () => {
        skipTraining();
        for (let i=0; i<4; i++) {
            pressKey("1"); // four practice recall prompts
        }
        pressKey(" "); // instruction screen

        let learnPics = [];
        for (let i=0; i<16; i++) {
            jest.advanceTimersByTime(5000);
            const data = jsPsych.data.get().last(1).values()[0];
            learnPics.push(data.picId);
        }
        expect(learnPics.slice(0, 8)).toStrictEqual(learnPics.slice(8, 16)); // second repetition of eight faces should be same order as first one
        learnPics = learnPics.slice(0, 8);

        const recallPics = [];
        for (let i=0; i<8; i++) {
            pressKey("1");
            const data = jsPsych.data.get().last(1).values()[0];
            recallPics.push(data.picId);
        }
        expect(learnPics.length).toEqual(recallPics.length);
        expect(learnPics).toEqual(expect.arrayContaining(recallPics)); // they should have the same elements...
        const haveSameOrder = learnPics.reduce((prev, cur, idx) => prev && cur === recallPics[idx], true);
        expect(haveSameOrder).toBe(false); // ...but not in the same order
    });

    it("should show the learning prompts in a different order to different participants", () => {
        pressKey(" ");
        pressKey(" "); // skip two instruction screens

        const learnPics1 = [];
        for (let i=0; i<4; i++) {
            jest.advanceTimersByTime(5000);
            const data = jsPsych.data.get().last(1).values()[0];
            learnPics1.push(data.picId);
        }

        jsPsych.init({
            timeline: getTimeline()
        });
        pressKey(" ");
        pressKey(" ");

        const learnPics2 = [];
        for (let i=0; i<4; i++) {
            jest.advanceTimersByTime(5000);
            const data = jsPsych.data.get().last(1).values()[0];
            learnPics2.push(data.picId);
        }
        
        expect(learnPics1.length).toEqual(learnPics2.length);
        expect(learnPics1).toEqual(expect.arrayContaining(learnPics2));
        const haveSameOrder = learnPics1.reduce((prev, cur, idx) => prev && cur === learnPics2[idx], true);
        expect(haveSameOrder).toBe(false);
    });
});

describe("In sets 2-5 and 8-11, FaceName", () => {
    let timeline;
    let setNum;
    beforeEach(() => {
        setNum = +jsPsych.randomization.sampleWithoutReplacement([2,3,4,5,8,9,10,11], 1); // use '+' to make setNum a number, not an object
        timeline = getTimeline(setNum);
        jsPsych.init({
            timeline: timeline,
        });
    });

    it("should not have any practice", () => {
       checkNoPractice(timeline);
    });

    it("should show all of the faces from the previous set and the current set during the recall test", () => {
        expect(timeline[5].timeline_variables.length).toBe(16); // 0 and 1 are instructions, 2 and 3 learning, 4 recall intro, 5 recall trial
        const names = timeline[5].timeline_variables.map(tlv => tlv.name);
        const nameSet = new Set(names);
        const prevSet = setNum - 1;
        const prevSetKey = "Set" + prevSet;
        const setKey = "Set" + setNum;
        const stims = stimuli[setKey].concat(stimuli[prevSetKey]);
        const stimNames = new Set(stims.map(s => s.name));
        expect(nameSet).toStrictEqual(stimNames);
    });
});

describe("In sets 6 and 12, FaceName", () => {
    let timeline;
    let setNum;
    beforeEach(() => {
        setNum = +jsPsych.randomization.sampleWithoutReplacement([6, 12], 1); // use '+' to make setNum a number, not an object
        timeline = getTimeline(setNum);
        jsPsych.init({
            timeline: timeline,
        });
    });

    it("should not have any practice", () => {
        checkNoPractice(timeline);
    });

    it("should show all of the faces from the previous 5 sets and the current set during the recall test", () => {
        expect(timeline[5].timeline_variables.length).toBe(48); // 0 and 1 are instructions, 2 and 3 learning, 4 recall intro, 5 recall trial
        const names = timeline[5].timeline_variables.map(tlv => tlv.name);
        const nameSet = new Set(names);
        let stims = [];
        for (let i=setNum-5; i<=setNum; i++) {
            const setKey = "Set" + i;
            stims = stims.concat(stimuli[setKey].map(s => s.name));
        }
        const stimSet = new Set(stims);
        expect(nameSet).toStrictEqual(stimSet);
    });
});

function doFirstTrainingPrompt() {
    pressKey(" ");
    pressKey(" ");
    jest.advanceTimersByTime(5000);
}

function skipTraining() {
    pressKey(" ");
    pressKey(" "); // two instruction screens
    for (let i=0; i<8; i++)  { // eight prompts
        jest.advanceTimersByTime(5000);
    }
    pressKey(" "); // one more instruction screen
}

function doFirstRecall(answerCorrectly) {
    skipTraining();
    const correctName = jsPsych.timelineVariable("name", true);
    const match = jsPsych.getDisplayElement().innerHTML.match(prompPat);
    if( (match[1] === correctName && answerCorrectly) || (match[1] !== correctName && !answerCorrectly) ) {
        pressKey("1");
    } else {
        pressKey("2");
    }
    return jsPsych.data.get().last(1).values()[0];
}

function checkNoPractice(timeline) {
    expect(timeline.length).toBe(6);
    expect(timeline[2].timeline_variables.length).toBe(8); // 0 and 1 are instructions; 2 should be first learning triel
    expect(timeline[3].timeline_variables.length).toBe(8); // second learning trial
}
