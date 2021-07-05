import { NBack } from "../n-back/n-back.js";

describe("n-back", () => {
    it.skip("results should have at least one result marked isRelevant", () => {
        // check timeline nodes
        const timeline = (new NBack()).getTimeline();
        expect(timeline.some(trial => trial.data && trial.data.isRelevant)).toBe(true);
        // check generated data
        expect(false).toBe(true);
    });
});
