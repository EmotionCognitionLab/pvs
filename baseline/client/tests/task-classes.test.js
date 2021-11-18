import { DailyStressors } from "../daily-stressors/daily-stressors.js";
import { Dass } from "../dass/dass.js";
import { Demographics } from "../demographics/demographics.js";
import { FaceName } from "../face-name/face-name.js";
import { Ffmq } from "../ffmq/ffmq.js";
import { Flanker } from "../flanker/flanker.js";
import { MindEyes } from "../mind-eyes/mind-eyes.js";
import { MoodMemory } from "../mood-memory/mood-memory.js";
import { MoodPrediction } from "../mood-prediction/mood-prediction.js";
import { NBack } from "../n-back/n-back.js";
import { Panas } from "../panas/panas.js";
import { PatternSeparation } from "../pattern-separation/pattern-separation.js";
import { PhysicalActivity } from "../physical-activity/physical-activity.js";
import { SpatialOrientation } from "../spatial-orientation/spatial-orientation.js";
import { TaskSwitching } from "../task-switching/task-switching.js";
import { VerbalFluency } from "../verbal-fluency/verbal-fluency.js";
import { VerbalLearning } from "../verbal-learning/verbal-learning.js";

describe.each([
    [ "DailyStressors", DailyStressors ],
    [ "Dass", Dass ],
    [ "Demographics", Demographics ],
    [ "FaceName", FaceName ],
    [ "Ffmq", Ffmq ],
    [ "Flanker", Flanker ],
    [ "MindEyes", MindEyes ],
    [ "MoodMemory", MoodMemory ],
    [ "MoodPrediction", MoodPrediction ],
    [ "NBack", NBack ],
    [ "Panas", Panas ],
    [ "PatternSeparation", PatternSeparation ],
    [ "PhysicalActivity", PhysicalActivity ],
    [ "SpatialOrientation", SpatialOrientation ],
    [ "TaskSwitching", TaskSwitching ],
    [ "VerbalFluency", VerbalFluency ],
    [ "VerbalLearning", VerbalLearning ],
])("%s", (name, taskClass) => {
    
    it(`${name} has taskName`, () => {
        expect(typeof taskClass.taskName).toBe("string");
        const args = (() => {
            switch (taskClass) {
                case VerbalFluency:
                    return [VerbalFluency.possibleLetters[0]];
                case VerbalLearning:
                    return [1, 1];
                default:
                    return [1];
            }
        })();
        const inst = new taskClass(...args);
        expect(typeof inst.taskName).toBe("string");
    });
    
    it(`${name} has getTimeline`, () => {
        expect(typeof taskClass.prototype.getTimeline).toBe("function");
    });
});
