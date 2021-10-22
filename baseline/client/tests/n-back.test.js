import { NBack } from "../n-back/n-back.js";
import { pressKey, cartesianProduct } from "./utils.js"

const completeCurrentTrial = correctly => {
    const trial = jsPsych.currentTrial();
    const progress = jsPsych.progress();
    if (trial.type === "html-keyboard-response") {
        if (typeof trial.trial_duration === "number") {
            jest.advanceTimersByTime(trial.trial_duration);
        } else {
            pressKey(trial.choices[0]);
        }
    } else if (trial.type === "n-back") {
        trial.sequence.forEach((x, i) => {
            if (correctly && (trial.n === 0 ? x === "1" : x === trial.sequence[i - trial.n])) {
                pressKey(" ", true);
            }
            jest.advanceTimersByTime(trial.show_duration + trial.hide_duration);
        });
    }
    // assert that progress occurred
    if (jsPsych.progress().current_trial_global <= progress.current_trial_global) {
        throw Error("progress didn't increase");
    }
};

describe("n-back", () => {
    it("results should have at least one result marked isRelevant", () => {
        // check timeline nodes
        const timeline = (new NBack(1)).getTimeline();
        expect(timeline.some(trial => trial.data && trial.data.isRelevant)).toBe(true);
        // check generated data
        jest.useFakeTimers("legacy");
        let complete = false;
        jsPsych.init({
            timeline: timeline,
            on_finish: () => { complete = true; },
        });
        for (let trials = 0; !complete; ++trials) {
            if (trials > 100) { throw new Error("too many trials"); }
            completeCurrentTrial(true);
        }
        const relevant = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevant.length).toBeGreaterThan(0);
    });

    it("short practice loops until completed correctly", () => {
        // helper to parse timeline node ids
        const parseNodeID = id => id.split("-").map(pair => pair.split(".").map(s => parseInt(s, 10)));
        // start timeline
        jest.useFakeTimers("legacy");
        let complete = false;
        jsPsych.init({
            timeline: (new NBack(1)).getTimeline(),
            on_finish: () => { complete = true; },
        });
        const completeNTrials = (n, correctly) => {
            for (let i = 0; i < n && !complete; ++i) {
                completeCurrentTrial(correctly);
            }
        }
        // complete 100 trials incorrectly
        completeNTrials(100, false);
        // should be at an n-back short practice sub-timeline
        const idA = parseNodeID(jsPsych.currentTimelineNodeID());
        expect(complete).toBe(false);
        // complete another 10 trials incorrectly
        completeNTrials(10, false);
        // should still be at the same n-back short practice sub-timeline
        const idB = parseNodeID(jsPsych.currentTimelineNodeID());
        expect(idB[0]).toStrictEqual(idA[0]);  // same top-level timeline node and same iteration
        expect(idB[1][0]).toStrictEqual(idA[1][0]);  // same sub-level timeline node of the top-level timeline node
        expect(idB[1][1]).toBeGreaterThan(idA[1][1]);  // but greater iteration of the sub-level timeline node
        // complete 100 trials correctly
        completeNTrials(100, true);
        // should have completed timeline
        expect(complete).toBe(true);
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
