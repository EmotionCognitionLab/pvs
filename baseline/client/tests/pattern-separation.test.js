/* eslint-disable no-irregular-whitespace */

require("@adp-psych/jspsych/jspsych.js");
import { PatternSeparation } from "../pattern-separation/pattern-separation.js";
import { pressKey, lastData } from "./utils.js";
import stimuli from "../pattern-separation/stimuli.json";

describe("PatternSeparation learning phase", () => {
    let tl;
    const setNum = 2;

    beforeEach(() => {
        tl = (new PatternSeparation(setNum, false)).getTimeline().slice(1); // drop preload; doesn't play well with jest
        jsPsych.init({timeline: tl});
        jest.useFakeTimers("legacy");
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("should have at least one result marked isRelevant", () => {
        doFirstTrial();
        expect(lastData("isRelevant")).toBe(true);
    });

    it("should mark practice trials isPractice", () => {
        doFirstTrial();
        expect(lastData("isPractice")).toBe(true);
    });

    it("should mark learning trials isLearning", () => {
        doFirstTrial();
        expect(lastData("isLearning")).toBe(true);
    });

    it("include the image id in the data", () => {
        doFirstTrial();
        expect(lastData("pic")).toBe(tl[3].timeline_variables[0].pic);
    });

    it("should include the image type in the data", () => {
        doFirstTrial();
        expect(lastData("type")).toBe(tl[3].timeline_variables[0].type);
    });

    it("should randomize the order of the stimuli", () => {
        const tl2 = (new PatternSeparation(2, false)).getTimeline().slice(1); // drop preload; doesn't play well with jest
        for (let i of [3,5,7,10,12]) { // timeline entries that aren't instructions
            expect(tl[i].timeline_variables.length).toEqual(tl2[i].timeline_variables.length);
            expect(tl2[i].timeline_variables).toEqual(expect.arrayContaining(tl[i].timeline_variables));
            expect(tl[i].timeline_variables).not.toStrictEqual(tl2[i].timeline_variables);
        }
    });

    it("should show the stimuli twice during the learning phase, using the same order the second time", () => {
        expect(tl[3].timeline_variables).toStrictEqual(tl[5].timeline_variables);
        expect(tl[10].timeline_variables).toStrictEqual(tl[12].timeline_variables);
    });

    it("should use the shoebox prompt on the first showing of a learning stimulus", () => {
        skipInstructions();
        for (let i=0; i<tl[3].timeline_variables.length; i++) {
            const prompt = document.getElementById("prompt").innerHTML;
            expect(prompt).toMatch(/shoe box/);
            pressKey("y");
            jest.advanceTimersByTime(3000);
        }
    });

    it("should use the right hand prompt on the second showing of a learning stimulus", () => {
        skipInstructions();
        for (let i=0; i<tl[3].timeline_variables.length; i++) {
            pressKey("y");
            jest.advanceTimersByTime(3000);
        }
        pressKey(" "); // skip the round 2 screen
        for (let i=0; i<tl[5].timeline_variables.length; i++) {
            const prompt = document.getElementById("prompt").innerHTML;
            expect(prompt).toMatch(/right hand/);
            pressKey("y");
            jest.advanceTimersByTime(3000);
        }
    });

    it("should only show images marked 'target'", () => {
        const practiceStims = stimuli["Practice"];
        const allStims = practiceStims.concat(stimuli["Set"+setNum]);
        const nonTargetPics = allStims.filter(s => s.type !== "Target").map(s => s.pic);
        const learningNodes = tl.filter(node => node.timeline && node.timeline[0].data.isLearning);
        expect(learningNodes.length).toBeGreaterThan(0);
        for (let node of learningNodes) {
            for (let tlVar of node.timeline_variables) {
                expect(tlVar.type).toBe("Target");
                expect(nonTargetPics).not.toContain(tlVar.pic);
            }
        }
    });

    it("should keep learning stimuli on the screen for 3000ms if the user responds to the prompt", () => {
        skipInstructions();
        const img = document.getElementsByTagName("img")[0].getAttribute("src");
        pressKey("y");
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).toBe(img);
        jest.advanceTimersByTime(2999);
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).toBe(img);
        jest.advanceTimersByTime(2);
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).not.toBe(img);
    });

    it("should keep learning stimuli on the screen for 3000ms if the user doesn't respond to the prompt", () => {
        skipInstructions();
        const img = document.getElementsByTagName("img")[0].getAttribute("src");
        jest.advanceTimersByTime(2999);
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).toBe(img);
        jest.advanceTimersByTime(2);
        expect(document.getElementsByTagName("img").length).toBe(0);
    });

    it("should keep learning stimuli on the screen for 3000ms during the actual (non-practice) test", () => {
        skipInstructions();
        for (let i=0; i<stimuli["Practice"].length * 2; i++) {
            jest.advanceTimersByTime(3000);
        }
        pressKey(" ");
        for (let i=0; i<stimuli["Practice"].length * 2; i++) {
           pressKey("1");
        }
        pressKey(" ");
        const img = document.getElementsByTagName("img")[0].getAttribute("src");
        jest.advanceTimersByTime(2999);
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).toBe(img);
        jest.advanceTimersByTime(2);
        expect(document.getElementsByTagName("img").length).toBe(0);
    });

    it("should tell the user to answer faster if they don't answer within 3000ms", () => {
        skipInstructions();
        jest.advanceTimersByTime(3000);
        expect(jsPsych.getDisplayElement().innerHTML).toMatch(/Answer faster/);
    });

    it("should only show learning stimuli when isRecall is false (excluding practice)", () => {
        for (let node of tl.slice(8)) { // entries 0-7 are instructions and practice
            if (node.timeline) {
                const subTl = node.timeline[0];
                expect(subTl.prompt).not.toMatch(/1 = definitely old/);
                expect(subTl.choices).toStrictEqual(["y", "n"]);
            }
        }
    });

    it("should show different stimuli for different sets", () => {
        const tl2 = (new PatternSeparation(4, false)).getTimeline().slice(1); // drop preload; doesn't play well with jest
        for (let i=10; i<tl.length; i++) { // entries 0-9 are instructions and practice in set 2
            const node = tl[i];
            if (!node.timeline_variables) continue;
            expect(node.timeline_variables).not.toStrictEqual(tl2[i - 10].timeline_variables); // -10 because set 4 should not have practice
        }
    });
});

describe("PatternSeparation recall phase", () => {
    let recallTl;

    beforeEach(() => {
        recallTl = (new PatternSeparation(2, true)).getTimeline().slice(1); // drop preload; doesn't play well with jest
        jsPsych.init({timeline: recallTl});
    });

    it("should only show recall stimuli when isRecall is true", () => {
        expect(recallTl.length).toBe(2);
        expect(recallTl[1].timeline[0].prompt).toMatch(/1 = definitely old/);
    });

    it("should display the next recall stimulus when the user responds to the current one", () => {
        pressKey(" ");
        const img = document.getElementsByTagName("img")[0].getAttribute("src");
        pressKey("1");
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).not.toBe(img);
    });

    it("should mark recall trials isRecall", () => {
        pressKey(" ");
        pressKey("2");
        expect(lastData("isRecall")).toBe(true);
    });

    it("should show all of the practice recall stimuli during practice", () => {
        const practiceTl = (new PatternSeparation(2, false)).getTimeline().slice(1); // drop preload
        const practiceStim = stimuli["Practice"];
        const practiceRecallIdx = 7;
        expect(practiceTl[practiceRecallIdx].timeline_variables.length).toBe(practiceStim.length);
    });

});

function skipInstructions() {
    pressKey(" "); // first instruction screen
    pressKey(" "); // second instruction screen
    pressKey(" "); // third instruction screen
}

function doFirstTrial() {
    skipInstructions();
    doLearningTrial();
}

function doLearningTrial() {
    pressKey("y");
    jest.advanceTimersByTime(3000); // get to end of trial
}
