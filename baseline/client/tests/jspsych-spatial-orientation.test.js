import "@adp-psych/jspsych/jspsych.js";
import "js/jspsych-spatial-orientation.js";
import "jest-canvas-mock";

beforeEach(() => {
    jest.useFakeTimers("legacy");
});

afterEach(() => {
    jest.useRealTimers();
});

describe("jspsych-spatial-orientation.js plugin", () => {
    it("loads correctly", () => {
        expect(jsPsych.plugins["spatial-orientation"]).toBeDefined();
    });

    it("registers clicks correctly", () => {
        const dataFromClick = (x, y) => {
            jsPsych.init({timeline: [{
                type: "spatial-orientation",
                scene: "scene",
                centerText: "center",
                topText: "top",
                pointerText: "pointer",
                targetRadians: 0,
                mode: "test",
            }]});
            const icirc = document.getElementById("jspsych-spatial-orientation-icirc");
            const rect = icirc.getBoundingClientRect();
            icirc.dispatchEvent(new MouseEvent("click", {
                clientX: +x + icirc.width/2 + rect.left,
                clientY: -y + icirc.height/2 + rect.top,
            }));
            jest.runAllTimers();
            // expect trial and timeline to be completed
            const progress = jsPsych.progress();
            expect(progress.current_trial_global).toBe(progress.total_trials);
            // expect responseRadians to be a number
            const data = jsPsych.data.getLastTrialData().values()[0];
            expect(typeof data.responseRadians).toBe("number");
            return data;
        };
        expect(dataFromClick(0, 1).responseRadians).toBeCloseTo(0);
        expect(dataFromClick(-123, 0).responseRadians).toBeCloseTo(Math.PI/2);
        expect(dataFromClick(2, -2).responseRadians).toBeCloseTo(-Math.PI*3/4);
        // please don't explode
        expect(dataFromClick(0, 0)).not.toBe(NaN);
    });

    it("skips if started past endTime", () => {
        jsPsych.init({timeline: [{
            type: "spatial-orientation",
            scene: "scene",
            centerText: "center",
            topText: "top",
            pointerText: "pointer",
            targetRadians: 0,
            mode: "test",
            endTime: -1,
        }]});
        // expect trial and timeline to be completed
        const progress = jsPsych.progress();
        expect(progress.current_trial_global).toBe(progress.total_trials);
        // expect completionReason to be "skipped"
        const data = jsPsych.data.getLastTrialData().values()[0];
        expect(data.completionReason).toBe("skipped");
    });
    
    it("stops when encountering endTime", () => {
        jsPsych.init({timeline: [{
            type: "spatial-orientation",
            scene: "scene",
            centerText: "center",
            topText: "top",
            pointerText: "pointer",
            targetRadians: 0,
            mode: "test",
            lingerDuration: 0,
            endTime: Date.now() + 1000,
        }]});
        // expect trial and timeline to NOT be completed at the start
        const progressA = jsPsych.progress();
        expect(progressA.current_trial_global).toBeLessThan(progressA.total_trials);
        // expect trial and timeline to still NOT be completed after only 100 ms
        jest.advanceTimersByTime(100);
        const progressB = jsPsych.progress();
        expect(progressB.current_trial_global).toBeLessThan(progressB.total_trials);
        // expect trial and timeline to be completed after more than 1000 ms
        jest.advanceTimersByTime(1000);
        const progressC = jsPsych.progress();
        expect(progressC.current_trial_global).toBe(progressC.total_trials);
        // expect completionReason to be "timedout"
        const data = jsPsych.data.getLastTrialData().values()[0];
        expect(data.completionReason).toBe("timedout");
    });

    it("records all important parameters", () => {
        const trial = {
            type: "spatial-orientation",
            scene: "scene",
            centerText: "a",
            topText: "b",
            pointerText: "c",
            targetRadians: 0,
            mode: "test",
            endTime: -1,
        };
        jsPsych.init({timeline: [trial]});
        const data = jsPsych.data.getLastTrialData().values()[0];
        expect(data.center).toBe(trial.centerText);
        expect(data.facing).toBe(trial.topText);
        expect(data.target).toBe(trial.pointerText);
        expect(data.mode).toBe(trial.mode);
        expect(typeof data.targetRadians).toBe("number");
        expect(data.timeLimit).toBeLessThanOrEqual(0);
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
