import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-spatial-orientation.js";

describe("jspsych-spatial-orientation.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["spatial-orientation"]).toBeDefined();
    });
});

describe("angleABC helper", () => {
    const angleABC = jsPsych.plugins["spatial-orientation"].angleABC;
    it("works correctly", () => {
        for (let a = -1.23; a < 6*Math.PI; a += Math.PI/12) {
            [0, Math.PI/2, Math.PI/3, Math.PI/5, Math.PI/7, Math.PI/11].forEach(offset => {
                const b = a + offset;
                const u = [Math.cos(a), Math.sin(a)];
                const v = [Math.cos(b), Math.sin(b)];
                expect(angleABC(u, [0, 0], v)).toBeCloseTo(offset);
                expect(angleABC(v, [0, 0], u)).toBeCloseTo(-offset);
            });
        }
    });

    it("doesn't explode", () => {
        expect(() => angleABC([0, 0], [0, 0], [0, 0])).not.toThrow();
        expect(typeof angleABC([0, 0], [0, 0], [0, 0])).toBe("number");
    });
});
