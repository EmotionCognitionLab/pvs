import { NBack } from "../n-back/n-back.js";
import { pressKey, cartesianProduct } from "./utils.js"

describe("n-back", () => {
    it("results should have at least one result marked isRelevant", () => {
        // check timeline nodes
        const timeline = (new NBack(1)).getTimeline();
        expect(timeline.some(trial => trial.data && trial.data.isRelevant)).toBe(true);
        // check generated data
        jest.useFakeTimers("legacy");
        jsPsych.init({timeline: timeline});
        timeline.forEach(() => {
            jest.runAllTimers();
            pressKey(" "); pressKey("0");
        });
        const progress = jsPsych.progress();
        expect(progress.current_trial_global).toBe(progress.total_trials);
        const relevant = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevant.length).toBeGreaterThan(0);
    });

    it("n-back plugin trials are preceded by cues", () => {
        const timeline = (new NBack(1)).getTimeline();
        expect(
            timeline.every((trial, index) => {
                if (trial.type === "n-back") {
                    const expected_cue = (
                        trial.n === 0 ? NBack.cue0 :
                        trial.n === 1 ? NBack.cue1 :
                        trial.n === 2 ? NBack.cue2 :
                        null
                    );
                    return expected_cue !== null && timeline[index - 1] === expected_cue;
                } else {
                    return true;
                }
            })
        ).toBe(true);
    });

    it("n-back plugin trials are succeeded by rests", () => {
        const timeline = (new NBack(1)).getTimeline();
        expect(
            timeline.every((trial, index) => {
                if (trial.type === "n-back") {
                    return timeline[index + 1] === NBack.rest;
                } else {
                    return true;
                }
            })
        ).toBe(true);
    });

    it("generates random n-back sequences correctly", () => {
        const nback = new NBack(1);
        const choicess = [["1", "2", "3", "4", "5", "6", "7", "8", "9"]];
        const lengths = [15, 16, 17, 18, 19, 20];
        const ns = [0, 1, 2];
        const targetss = [0, 1, 2, 3, 4, 5];
        for (
            const [choices, length, n, targets]
            of cartesianProduct(choicess, lengths, ns, targetss)
        ) {
            const sequence = nback.randSequence(choices, length, n, targets);
            expect(sequence.every(item => choices.includes(item))).toBe(true);
            expect(sequence.length).toBe(length);
            expect(
                sequence
                    .filter((x, i) => n === 0 ? x === "1" : x === sequence[i - n])
                    .length
            ).toBe(targets);
        }
    });
});
