import { DailyStressors } from "../daily-stressors/daily-stressors.js";
import { Flanker } from "../flanker/flanker.js";
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { MoodPrediction } from "../mood-prediction/mood-prediction.js";
import { Panas } from "../panas/panas.js";
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";

describe("task classes", () => {
    const classes = [
        DailyStressors,
        Flanker,
        MoodMemory,
        MoodPrediction,
        Panas,
        VerbalFluency,
        VerbalLearning,
    ];
    
    it("each has taskName", () => {
        classes.forEach(c => {
            expect(typeof c.taskName).toBe("string");
        });
    });
    
    it("each has getTimeline", () => {
        classes.forEach(c => {
            expect(typeof c.prototype.getTimeline).toBe("function");
        });
    });
});
