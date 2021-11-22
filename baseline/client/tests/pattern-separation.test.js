/* eslint-disable no-irregular-whitespace */

require("@adp-psych/jspsych/jspsych.js");
import { PatternSeparation } from "../pattern-separation/pattern-separation.js";
import { pressKey, lastData } from "./utils.js";
import stimuli from "../pattern-separation/stimuli.json";

describe("PatternSeparation learning phase", () => {
    let tl;
    const setNum = 1;

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
        const tl2 = (new PatternSeparation(1, false)).getTimeline().slice(1); // drop preload; doesn't play well with jest
        for (let i of [2,3,5,7,8]) { // timeline entries that aren't instructions
            expect(tl[i].timeline_variables.length).toEqual(tl2[i].timeline_variables.length);
            expect(tl2[i].timeline_variables).toEqual(expect.arrayContaining(tl[i].timeline_variables));
            expect(tl[i].timeline_variables).not.toStrictEqual(tl2[i].timeline_variables);
        }
    });

    it("should show the stimuli twice during the learning phase, using the same order the second time", () => {
        expect(tl[2].timeline_variables).toStrictEqual(tl[3].timeline_variables);
        expect(tl[7].timeline_variables).toStrictEqual(tl[8].timeline_variables);
    });

    it("should use the shoebox prompt on the first showing of a learning stimulus", () => {
        pressKey(" ");
        pressKey(" ");
        for (let i=0; i<tl[2].timeline_variables.length; i++) {
            const prompt = document.getElementById("prompt").innerHTML;
            expect(prompt).toMatch(/shoe box/);
            pressKey("y");
            jest.advanceTimersByTime(3000);
        }
    });

    it("should use the right hand prompt on the second showing of a learning stimulus", () => {
        pressKey(" ");
        pressKey(" ");
        for (let i=0; i<tl[2].timeline_variables.length; i++) {
            pressKey("y");
            jest.advanceTimersByTime(3000);
        }
        for (let i=0; i<tl[3].timeline_variables.length; i++) {
            const prompt = document.getElementById("prompt").innerHTML;
            expect(prompt).toMatch(/right hand/);
            pressKey("y");
            jest.advanceTimersByTime(3000);
        }
    });

    it("should only show images marked 'target' during the learning phase", () => {
        const practiceStims = stimuli["Practice"];
        const allStims = practiceStims.concat(stimuli["Set"+setNum]);
        const nonTargetPics = allStims.filter(s => s.type !== "Target").map(s => s.pic);
        const nodesWithTimelineVars = tl.filter(node => node.timeline_variables);
        expect(nodesWithTimelineVars.length).toBeGreaterThan(0);
        for (let node of nodesWithTimelineVars) {
            for (let tlVar of node.timeline_variables) {
                expect(tlVar.type).toBe("Target");
                expect(nonTargetPics).not.toContain(tlVar.pic);
            }
        }
    });

    it("should keep learning stimuli on the screen for 3000ms if the user responds to the prompt", () => {
        pressKey(" ");
        pressKey(" ");
        const img = document.getElementsByTagName("img")[0].getAttribute("src");
        pressKey("y");
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).toBe(img);
        jest.advanceTimersByTime(2999);
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).toBe(img);
        jest.advanceTimersByTime(2);
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).not.toBe(img);
    });

    it("should keep learning stimuli on the screen for 3000ms if the user doesn't respond to the prompt", () => {
        pressKey(" ");
        pressKey(" ");
        const img = document.getElementsByTagName("img")[0].getAttribute("src");
        jest.advanceTimersByTime(2999);
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).toBe(img);
        jest.advanceTimersByTime(2);
        expect(document.getElementsByTagName("img").length).toBe(0);
    });

    it("should keep learning stimuli on the screen for 2500ms during the actual (non-practice) test", () => {
        pressKey(" ");
        pressKey(" ");
        for (let i=0; i<stimuli["Practice"].length * 2; i++) {
            jest.advanceTimersByTime(3000);
        }
        pressKey(" ");
        for (let i=0; i<stimuli["Practice"].length * 2; i++) {
           pressKey("1");
        }
        pressKey(" ");
        const img = document.getElementsByTagName("img")[0].getAttribute("src");
        jest.advanceTimersByTime(2499);
        expect(document.getElementsByTagName("img")[0].getAttribute("src")).toBe(img);
        jest.advanceTimersByTime(2);
        expect(document.getElementsByTagName("img").length).toBe(0);
    });

    it("should tell the user to answer faster if they don't answer within 3000ms", () => {
        pressKey(" ");
        pressKey(" ");
        jest.advanceTimersByTime(3000);
        expect(jsPsych.getDisplayElement().innerHTML).toMatch(/Answer faster/);
    });

    it("should only show learning stimuli when isRecall is false (excluding practice)", () => {
        for (let node of tl.slice(7)) { // entries 0-6 are instructions and practice
            if (node.timeline) {
                const subTl = node.timeline[0];
                expect(subTl.prompt).not.toMatch(/1 = definitely old/);
                expect(subTl.choices).toStrictEqual(["y", "n"]);
            }
        }
    });

    it("should show different stimuli for different sets", () => {
        const tl2 = (new PatternSeparation(3)).getTimeline().slice(1); // drop preload; doesn't play well with jest
        for (let i=7; i<tl.length; i++) { // entries 0-6 are instructions and practice in set 1
            const node = tl[i];
            expect(node.timeline_variables);
            expect(node.timeline_variables).not.toStrictEqual(tl2[i - 7].timeline_variables); // -7 because set 3 should not have proactice
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

});

function doFirstTrial() {
    pressKey(" "); // first instruction screen
    pressKey(" "); // second instruction screen
    doLearningTrial();
}

function doLearningTrial() {
    pressKey("y");
    jest.advanceTimersByTime(3000); // get to end of trial
}
