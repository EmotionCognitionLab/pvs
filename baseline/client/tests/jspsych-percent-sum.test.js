require("@adp-psych/jspsych/jspsych.js");
require("../js/jspsych-percent-sum.js");

describe("jspsych-percent-sum.js plugin", () => {
    it("loads correctly", () => {
        expect(typeof window.jsPsych.plugins["percent-sum"]).not.toBe("undefined");
    });
    it("shows preamble", () => {
        const preamble = Math.random().toString();
        const trial = {
            type: "percent-sum",
            preamble: preamble,
            fields: ["a", "b", "c"],
        };
        jsPsych.init({
            timeline: [trial],
        });
        expect(jsPsych.getDisplayElement().innerHTML).toContain(preamble);
    });
});
