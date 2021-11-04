require("@adp-psych/jspsych/jspsych.js");
import { MindEyes } from "../mind-eyes/mind-eyes.js";
import { pressKey, lastData } from "./utils.js";
import stimuli from "../mind-eyes/stimuli.json";

describe("MindEyes", () => {
    beforeEach(() => {
        jsPsych.init({ timeline: (new MindEyes(1)).getTimeline() });
    });

    it("should have at least one result marked isRelevant", () => {
        doFirstTrial();
        expect(lastData("isRelevant")).toBe(true);
    });

    it("should mark practice trial isPractice", () => {
        doFirstTrial();
        expect(lastData("isPractice")).toBe(true);
    });

    it("should include the displayed picture in the data", () => {
        doFirstTrial();
        const dispElem = jsPsych.getDisplayElement();
        const images = dispElem.getElementsByTagName("img");
        expect(images.length).toBe(1);
        const imgUrl = images[0].getAttribute("src");
        const img = imgUrl.match(/https:\/\/.*\/([0-9]+).jpg/)[1];
        pressKey("1");
        const pic = lastData("pic");
        expect(pic+"").toBe(img);
    });

    it("should include the displayed words in the data", () => {
        doFirstTrial();
        const dispELem = jsPsych.getDisplayElement();
        const leftWords = dispELem.getElementsByClassName("mind-eyes-left");
        const rightWords = dispELem.getElementsByClassName("mind-eyes-right");
        expect(leftWords.length).toBe(2);
        expect(rightWords.length).toBe(2);
        const allWords = [];
        const wordPat = /[1-4]. ([a-z]+) <span/;
        for (let i=0; i<2; i++) {
           allWords.push(leftWords[i].innerHTML.match(wordPat)[1]);
           allWords.push(rightWords[i].innerHTML.match(wordPat)[1]);
        }
        pressKey("1");
        expect(lastData("words")).toStrictEqual(allWords);
    });

    it("should include the key the user pressed in the data", () => {
        doFirstTrial();
        pressKey("3");
        expect(lastData("response")).toBe("3");
    });

    it("should randomize the stimuli", () => {
        const setNum = 2;
        const tl = (new MindEyes(setNum)).getTimeline();
        const tlPics = tl[2].timeline_variables.map(item => item.pic);
        const stimPics = stimuli["Set"+setNum].map(s => s.pic);
        expect(tlPics.length).toBe(stimPics.length);
        expect(new Set(tlPics)).toStrictEqual(new Set(stimPics));
        expect(tlPics).not.toStrictEqual(stimPics);
    });

    it("should include a glossary entry for the words", () => {
        doFirstTrial();
        const dispElem = jsPsych.getDisplayElement();
        const tooltips = dispElem.querySelectorAll(".tooltiptext");
        for (let i=0; i<tooltips.length; i++) {
            expect(tooltips[i].innerHTML).toMatch(/[a-z]+/);
        }
    });
});

function doFirstTrial() {
    pressKey(" ");
    pressKey(" "); // skip two instruction screens;
    pressKey("1"); // respond to practice trial
}