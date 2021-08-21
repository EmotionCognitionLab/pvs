require("@adp-psych/jspsych/jspsych.js");
import { FaceName } from "../face-name/face-name.js";
import { pressKey } from "./utils.js"
import stimuli from "../face-name/stimuli.json";

const firstPracticeStim = stimuli.Practice[0];

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
        for (let i=0; i<3; i++)  { // two instruction screens, then first prompt
            pressKey(" ");
        }
        const data = jsPsych.data.get().last(1).values()[0];
        const category = firstPracticeStim.cat;
        expect(data.cat).toBe(category);
    });

    it("should include the image id in the data", () => {
        for (let i=0; i<3; i++)  { // two instruction screens, then first prompt
            pressKey(" ");
        }
        const data = jsPsych.data.get().last(1).values()[0];
        const picId = firstPracticeStim.picId;
        expect(data.picId).toBe(picId);
    });

    it("should include the correct name in the data on learning trials", () => {
        for (let i=0; i<3; i++)  { // two instruction screens, then first prompt
            pressKey(" ");
        }
        const data = jsPsych.data.get().last(1).values()[0];
        const name = firstPracticeStim.name;
        expect(data.name).toBe(name);
    });

    it("should include the correct name and the lure in the data on recall trials", () => {
        for (let i=0; i<11; i++)  { // two instruction screens, eight prompts, one more instruction screen
            pressKey(" ");
        }
        pressKey("1"); // first recall trial
        const data = jsPsych.data.get().last(1).values()[0];
        const name = firstPracticeStim.name;
        const lure = firstPracticeStim.lure;
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
        expect(s.size).toBe(2);
        s.forEach(entry => {
            const name1Count = name1.filter(item => item === entry).length;
            expect(name1Count).toBeGreaterThanOrEqual(37);
            expect(name1Count).toBeLessThanOrEqual(62);
            const name2Count = name2.filter(item => item === entry).length;
            expect(name2Count).toBe(repeatCount - name1Count);
        });
    });
});

function doFirstRecall(answerCorrectly) {
    for (let i=0; i<11; i++)  { // two instruction screens, eight prompts, one more instruction screen
        pressKey(" ");
    }
    const correctName = firstPracticeStim.name;
    const match = jsPsych.getDisplayElement().innerHTML.match(/1. ([a-zA-Z]+) 2. ([a-zA-Z]+)/);
    if( (match[1] === correctName && answerCorrectly) || (match[1] !== correctName && !answerCorrectly) ) {
        pressKey("1");
    } else {
        pressKey("2");
    }
    return jsPsych.data.get().last(1).values()[0];
}