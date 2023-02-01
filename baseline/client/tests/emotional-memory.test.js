import { EmotionalMemory } from "../emotional-memory/emotional-memory.js";
import { pressKey } from "./utils.js";
import "jest-canvas-mock";
import "regenerator-runtime/runtime";

describe("emotional-memory-learning", () => {
    beforeEach(() => {
        jest.useFakeTimers("legacy");
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("results should have as many isRelevant records as stimuli on completion", () => {
        const test = (timeline, stim) => {
            let complete = false;
            jsPsych.init({
                timeline: timeline,
                on_finish: () => { complete = true; },
            });
            pressKey(" ");
            for (let i = 0; i < stim.length; ++i) {
                jest.advanceTimersByTime(2 * EmotionalMemory.encodeDuration);
                pressKey("x");
            }
            expect(complete).toBe(true);
            expect(
                jsPsych.data.get().filter({isRelevant: true}).values().length
            ).toEqual(
                stim.length
            );
        };
        test((new EmotionalMemory(4)).getTimeline(), EmotionalMemory.stimulus.pre);
        test((new EmotionalMemory(10)).getTimeline(), EmotionalMemory.stimulus.post);
    });

    it("shows each stimulus", () => {
        const test = (timeline, stim) => {
            const remainingStim = new Set(stim);
            for (let i = 0; i < timeline.length; ++i) {
                const trial = timeline[i];
                if (trial.type === "image-keyboard-response") {
                    const next = timeline[i+1];
                    expect(remainingStim.delete(next.data.imagePath)).toBe(true);
                    expect(trial.stimulus.includes(next.data.imagePath)).toBe(true);
                }
            }
            expect(remainingStim.size).toEqual(0);
        };
        test((new EmotionalMemory(4)).getTimeline(), EmotionalMemory.stimulus.pre);
        test((new EmotionalMemory(10)).getTimeline(), EmotionalMemory.stimulus.post);
    });
});

describe("emotional-memory-recall", () => {
    global.confirm = () => true; // stub out window.confirm
    it("results should have at least one result marked isRelevant", () => {
        const responses = ["a", "b", "c"]
        const timeline = (new EmotionalMemory(6)).getTimeline();
        let complete = false;
        jsPsych.init({
            timeline,
            on_finish: () => { complete = true; },
        });
        const field = document.getElementById("jspsych-memory-field-field");
        for (const r of responses) {
            field.value = r;
            field.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter"}));
            field.dispatchEvent(new KeyboardEvent("keyup", {key: "Enter"}));
        }
        document.getElementById("jspsych-memory-field-button").click();
        expect(complete).toBe(true);
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData[0].response).toEqual(responses);
    });
});

describe("emotional-memory", () => {
    it("throws on invalid setNum", () => {
        for (const setNum of [1, 2, 3, 5, 7, 8, 9, 11]) {
            const f = () => new EmotionalMemory(setNum);
            expect(f).toThrow();
        }
    });
});
