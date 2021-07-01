require("@adp-psych/jspsych/jspsych.js");
require("../js/jspsych-percent-sum.js");

describe("jspsych-percent-sum.js plugin", () => {
    it("loads correctly", () => {
        expect(typeof jsPsych.plugins["percent-sum"]).not.toBe("undefined");
    });

    it("shows preamble", () => {
        const preamble = Math.random().toString();
        const trial = {
            type: "percent-sum",
            preamble: preamble,
            fields: ["a", "b", "c"],
        };
        jsPsych.init({timeline: [trial]});
        expect(jsPsych.getDisplayElement().innerHTML).toContain(preamble);
    });

    it("makes inputs from fields", () => {
        const fieldss = [
            ["dunder"],
            ["owo", "uwu"],
            ["x", "y", "z"],
            ["pootis", "run", "antibacterial", "badger"],
            ["a", "b", "c", "d", "e"],
        ];
        fieldss.forEach(fields => {
            const trial = {
                type: "percent-sum",
                preamble: "",
                fields: fields,
            };
            jsPsych.init({timeline: [trial]});
            const inputs = jsPsych.getDisplayElement().querySelectorAll("input[type=number]");
            // the number of inputs should match the number of fields
            expect(inputs.length).toBe(fields.length);
            const labels = jsPsych.getDisplayElement().querySelectorAll("label");
            // the number of labels should match the number of fields
            expect(labels.length).toBe(fields.length);
            // for each label there should exist a field that is a substring of the label
            labels.forEach(label => {
                expect(fields.some(field => label.textContent.includes(field))).toBe(true);
            });
        });
    });

    it("only enables continue button when sum is 100", () => {
        const trial = {
            type: "percent-sum",
            preamble: "",
            fields: ["a", "b", "c"],
        };
        jsPsych.init({timeline: [trial]});
        const [a, b, c] = jsPsych.getDisplayElement().querySelectorAll("input[type=number]");
        const button = jsPsych.getDisplayElement().querySelector("input[type=submit]");
        expect(button).not.toBeNull();
        expect(button.hasAttribute("disabled")).toBe(true);  // sum should be 0
        a.value = "20"; a.dispatchEvent(new Event("input"));
        b.value = "30"; b.dispatchEvent(new Event("input"));
        expect(button.hasAttribute("disabled")).toBe(true);  // sum should be 50
        c.value = "50"; c.dispatchEvent(new Event("input"));
        expect(button.hasAttribute("disabled")).toBe(false);  // sum should be 100
        a.value = "40"; a.dispatchEvent(new Event("input"));
        expect(button.hasAttribute("disabled")).toBe(true);  // sum should be 120
    });

    it("throws on empty fields", () => {
        const trial = {
            type: "percent-sum",
            preamble: "",
            fields: [],
        };
        expect(() => {
            jsPsych.init({
                timeline: [trial],
            });
        }).toThrow();
    });

    it("throws on duplicate fields", () => {
        const trial = {
            type: "percent-sum",
            preamble: "",
            fields: ["a", "b", "c", "b", "e"],
        };
        expect(() => {
            jsPsych.init({timeline: [trial]});
        }).toThrow();
    });
});