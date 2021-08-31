import { SpatialOrientation } from "../spatial-orientation/spatial-orientation.js";

describe("spatial-orientation", () => {
    it.todo("results should have at least one result marked isRelevant");

    it("has well-formed stimuli", () => {
        const validateTrial = trial => {
            const objectNames = [trial.center, trial.facing, trial.target];
            // each object should be distinct from each other object
            expect((new Set(objectNames)).size).toBe(3);
            // each object should have a defined position
            objectNames.forEach(name => {
                expect(SpatialOrientation.scenePositions[name]).toBeDefined();
            });
        };
        const allTrials = Object.values(SpatialOrientation.stimulus)
            .flatMap(phase => Object.values(phase))
            .flatMap(category => Object.values(category))
            .flatMap(set => set.trials);
        allTrials.forEach(validateTrial);
    });
});
