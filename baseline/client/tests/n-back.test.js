import { NBack } from "../n-back/n-back.js";
import { pressKey } from "./utils.js"

describe("n-back", () => {
    it("results should have at least one result marked isRelevant", () => {
        // check timeline nodes
        const timeline = (new NBack()).getTimeline();
        expect(timeline.some(trial => trial.data && trial.data.isRelevant)).toBe(true);
        // check generated data
        jest.useFakeTimers("legacy");
        jsPsych.init({timeline: timeline});
        pressKey(" ");  // skip introduction
        pressKey(" ");  // skip overall instruction
        pressKey(" "); jest.runAllTimers();  // skip 0-back instruction, cue, trial, and rest
        pressKey(" "); jest.runAllTimers();  // skip 1-back instruction, cue, trial, and rest
        pressKey(" "); jest.runAllTimers();  // skip 2-back instruction, cue, trial, and rest
        pressKey(" ");  // skip completion
        const progress = jsPsych.progress();
        expect(progress.current_trial_global).toBe(progress.total_trials);
        const relevant = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevant.length).toBeGreaterThan(0);
    });
    
    it("trials are preceded by cues", () => {
        const timeline = (new NBack()).getTimeline();
        const trial_indices = Array.from(timeline.entries())
            .filter(([_, t]) => t.type === "n-back")
            .map(([i, _]) => i);
        const cue_indices = trial_indices.map(i => i - 1);
        expect(cue_indices.every(i => timeline[i] === NBack.cue)).toBe(true);
    });
    
    it("non-final trials are succeeded by rests", () => {
        const timeline = (new NBack()).getTimeline();
        const trial_indices = Array.from(timeline.entries())
            .filter(([_, t]) => t.type === "n-back")
            .map(([i, _]) => i);
        const rest_indices = trial_indices.slice(0, -1).map(i => i + 1);
        expect(rest_indices.every(i => timeline[i] === NBack.rest)).toBe(true);
    });
});
