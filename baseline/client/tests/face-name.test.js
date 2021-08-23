require("@adp-psych/jspsych/jspsych.js");
import { FaceName } from "../face-name/face-name.js";
import { pressKey } from "./utils.js"

describe("FaceName", () => {
    
    beforeEach(() => {
        jsPsych.init({
            timeline: (new FaceName(1, [])).getTimeline(),
        });
    });

    it("should have at least one result marked isRelevant", () => {
        for (let i=0; i<11; i++)  { // two instruction screens, eight prompts, one more instruction screen
            pressKey(" ");
        }
        pressKey("1"); // respond to recall prompt
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.isRelevant).toBeTruthy();
    });

    it("should mark learning trials isLearning", () => {
        for (let i=0; i<3; i++)  { // two instruction screens, then first prompt
            pressKey(" ");
        }
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.isLearning).toBeTruthy();
    });

    it("should mark recall trials isRecall", () => {
        for (let i=0; i<11; i++)  { // two instruction screens, eight prompts, one more instruction screen
            pressKey(" ");
        }
        pressKey("1"); // respond to recall prompt
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.isRecall).toBeTruthy();
    });

    it("should mark practice trials isPractice", () => {
        for (let i=0; i<3; i++)  { // two instruction screens, then first prompt
            pressKey(" ");
        }
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
        pressKey(" "); // first prompt
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.cat).toBe(category);
    });

    it("should include the image id in the data", () => {
        for (let i=0; i<2; i++)  { // two instruction screens
        }
        const picId = jsPsych.timelineVariable("picId", true);
        pressKey(" "); // first prompt
        const data = jsPsych.data.get().last(1).values()[0];
        
        expect(data.picId).toBe(picId);
    });

    it("should include the correct name in the data on learning trials", () => {
        for (let i=0; i<2; i++)  { // two instruction screens
            pressKey(" ");
        }
        const name = jsPsych.timelineVariable("name", true);
        pressKey(" "); // first prompt
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.name).toBe(name);
    });

    it("should include the correct name and the lure in the data on recall trials", () => {
        for (let i=0; i<11; i++)  { // two instruction screens, eight prompts, one more instruction screen
            pressKey(" ");
        }
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
        for (let i=0; i<8; i++)  {
            pressKey(" ");
            pictures.push(jsPsych.getDisplayElement().getElementsByTagName("img")[0].attributes.getNamedItem("src").value);
            const name = jsPsych.getDisplayElement().innerHTML.match(/<br> ([a-zA-Z]+)<\/div>/)[1];
            names.push(name);   
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
                timeline: (new FaceName(1, [])).getTimeline(),
            });
            for (let i=0; i<11; i++)  { // two instruction screens, eight prompts, one more instruction screen
                pressKey(" ");
            }
            const match = jsPsych.getDisplayElement().innerHTML.match(/1. ([a-zA-Z]+) 2. ([a-zA-Z]+)/);
            name1.push(match[1]);
            name2.push(match[2]);
        }
        expect(name1.length).toBe(repeatCount);
        expect(name2.length).toBe(repeatCount);
        const s = new Set(name1);
        expect(s.size).toBe(4);
        s.forEach(entry => {
            const name1Count = name1.filter(item => item === entry).length;
            expect(name1Count).toBeGreaterThanOrEqual(18);
            expect(name1Count).toBeLessThanOrEqual(31);
            const name2Count = name2.filter(item => item === entry).length;
            expect(name2Count).toBeGreaterThanOrEqual(18);
            expect(name2Count).toBeLessThanOrEqual(31);
        });
    });

    it("should show the recall prompts in a different order than the learning prompts", () => {
        for (let i=0; i<11; i++)  { // two instruction screens, eight prompts, one more instruction screen
            pressKey(" ");
        }
        for (let i=0; i<4; i++) {
            pressKey("1"); // four practice recall prompts
        }
        pressKey(" "); // instruction screen

        let learnPics = [];
        for (let i=0; i<16; i++) {
            pressKey(" ");
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
            pressKey(" ");
            const data = jsPsych.data.get().last(1).values()[0];
            learnPics1.push(data.picId);
        }

        jsPsych.init({
            timeline: (new FaceName(1, [])).getTimeline(),
        });
        pressKey(" ");
        pressKey(" ");

        const learnPics2 = [];
        for (let i=0; i<4; i++) {
            pressKey(" ");
            const data = jsPsych.data.get().last(1).values()[0];
            learnPics2.push(data.picId);
        }
        
        expect(learnPics1.length).toEqual(learnPics2.length);
        expect(learnPics1).toEqual(expect.arrayContaining(learnPics2));
        const haveSameOrder = learnPics1.reduce((prev, cur, idx) => prev && cur === learnPics2[idx], true);
        expect(haveSameOrder).toBe(false);
    });
});

function doFirstRecall(answerCorrectly) {
    for (let i=0; i<11; i++)  { // two instruction screens, eight prompts, one more instruction screen
        pressKey(" ");
    }
    const correctName = jsPsych.timelineVariable("name", true);
    const match = jsPsych.getDisplayElement().innerHTML.match(/1. ([a-zA-Z]+) 2. ([a-zA-Z]+)/);
    if( (match[1] === correctName && answerCorrectly) || (match[1] !== correctName && !answerCorrectly) ) {
        pressKey("1");
    } else {
        pressKey("2");
    }
    return jsPsych.data.get().last(1).values()[0];
}