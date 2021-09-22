import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-countdown.js";

describe("jspsych-countdown.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["countdown"]).toBeDefined();
    });
});

describe("timestamp helper", () => {
    const timestamp = jsPsych.plugins["countdown"].timestamp;

    it("is defined", () => {
        expect(timestamp).toBeDefined;
    });

    it("works correctly", () => {
        [
            [-11111111111, "0:00:00"],
            [-1, "0:00:00"],
            [0, "0:00:00"],
            [1000, "0:00:01"],
            [1000 * 60, "0:01:00"],
            [1000 * 61, "0:01:01"],
            [1000 * 3600, "1:00:00"],
            [1000 * 3661, "1:01:01"],
            [1000 * 3600 * 25, "25:00:00"],
        ].forEach(([ms, str]) => {
            expect(timestamp(ms)).toBe(str);
        });
    });
});
