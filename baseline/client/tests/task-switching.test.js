require("@adp-psych/jspsych/jspsych.js");
import { TaskSwitching } from "../task-switching/task-switching.js";
import { pressKey } from "./utils.js";

describe("TaskSwitching timeline", () => {
    let tl;
    const stimPat = /<div class="(big|small) (ylw|blue)"><p>2<\/p><\/div>/;

    beforeEach(() => {
        const ts = new TaskSwitching();
        tl = ts.getTimeline();
    });
    it("should have six instructional screens", () => {
        // tl[0] is intro screen, tl[1-3] should be training
        for (let i = 1; i < 4; i++) {
            expect(tl[i].timeline[0].data.isTraining).toBe(true);
            expect(tl[i].timeline.length).toBe(2); // stimulus screen, feedback screen
            expect(tl[i].loop_function).toEqual(expect.any(Function)); // loop function to repeat training if user got it wrong
        }
    });
    it("should use a small font for the stimulus in the first three screens", () => {
        const match = tl[0].stimulus.match(stimPat);
        expect(match[1]).toBe("small");
        for (let i = 1; i < 2; i++) {
            const match = tl[i].timeline[0].stimulus.match(stimPat);
            expect(match[1]).toBe("small");
        }
    });
    it("should use a large font for the stimulus in the fourth screen", () => {
        const match = tl[3].timeline[0].stimulus.match(stimPat);
        expect(match[1]).toBe("big");
    });
    // checks the dedicated blocks of color/size/number that happen
    // after the initial instruction screens
    function confirmSingleBlock(tlIdx) {
        expect(tl[tlIdx].timeline.length).toBe(4);
        expect(tl[tlIdx].timeline_variables.length).toBe(34);
        const stimType = taskType(tl[tlIdx].timeline[0].stimulus);
        expect(stimType === "color" || stimType === "font size" || stimType === "number").toBeTruthy();
    }

    it("should show 34 color, size or number trials after the six instructional screens", () => {
        confirmSingleBlock(6);
    });
    it("should show a screen introducing the next trials after the first 34 trials", () => {
        expect(tl[7].stimulus).toMatch(/We are going to start a round of the task./);
    });
    it("should show 34 color, size or number trials after the trial intro screen", () => {
        confirmSingleBlock(8);
    });
    it("should show a screen introducing the next trials after the second 34 trials", () => {
        expect(tl[9].stimulus).toMatch(/We are going to start a round of the task./);
    });
    it("should show 34 color, size or number trials after the trial intro screen", () => {
        confirmSingleBlock(10);
    });
    it("should show a screen introducing the exercise trials after the final 34 trials", () => {
        expect(tl[11].stimulus).toBe('test-file-stub'); // blech - using imported html here prevents us from checking screen contents
        expect(tl[11].timeline).toBeUndefined();
    });
    it("should show 16 trials of varying task types after the exercise trial intro screen", () => {
        const taskTypes = [];
        for (let i = 12; i < 28; i++) {
            expect(tl[i].timeline.length).toBe(4);
            expect(tl[i].timeline_variables.length).toBe(1);
            taskTypes.push(taskType(tl[i].timeline[0].stimulus));
        }
        expect(taskTypes).toContain("color");
        expect(taskTypes).toContain("font size");
        expect(taskTypes).toContain("number");
        expect(taskTypes).not.toContain("unknown");
        // check that there aren't more than 16
        expect(tl[28].timeline).toBeUndefined();
    });
    it("should show a screen introducing the main trials after the exercise trials", () => {
        expect(tl[28].stimulus).toBe('test-file-stub'); // blech - again, using imported html here prevents us from checking screen contents
        expect(tl[28].timeline).toBeUndefined();
    });
    it("should then show 4 blocks of 34 trials of varying task types with a countdown delay in between each block", () => {
        let delayScreenCount = 0;
        for (let i = 1; i < 5; i++) {
            const taskTypes = [];
            for (let j = (29 * i) + (delayScreenCount * 6); j < (29 * i) + (delayScreenCount * 6) + 34; j++) {
                expect(tl[j].timeline.length).toBe(4);
                expect(tl[j].timeline_variables.length).toBe(1);
                taskTypes.push(taskType(tl[j].timeline[0].stimulus));
            }
            expect(taskTypes).toContain("color");
            expect(taskTypes).toContain("font size");
            expect(taskTypes).toContain("number");
            expect(taskTypes).not.toContain("unknown");
            const delayScreenIdx = (i * 29) + 34 + (delayScreenCount * 6);
            if (delayScreenCount < 3) {
                expect(tl[delayScreenIdx].timeline.length).toBe(1);
                expect(tl[delayScreenIdx].timeline[0].trial_duration).toBe(1000);
                expect(tl[delayScreenIdx].timeline_variables.length).toBe(15);
            }
            delayScreenCount++;
        }
    });
    it("should randomize the color, size and number displayed as the stimulus", () => {
        let numbers = [];
        let sizes = [];
        let colors = [];
        for (const item of tl) {
            if (item.timeline_variables) {
                numbers = numbers.concat(item.timeline_variables.map(tv => tv.number)).filter(num => typeof(num) != "undefined");
                sizes = sizes.concat(item.timeline_variables.map(tv => tv.size)).filter(size => typeof(size) != "undefined");
                colors = colors.concat(item.timeline_variables.map(tv => tv.color)).filter(col => typeof(col) != "undefined");
            }
        }
        
        const colorTestSet = new Set(colors);
        expect(colorTestSet).toStrictEqual(new Set(["blue", "ylw"]));
        const blueCount = colors.filter(c => c === "blue").length;
        expect(blueCount).toBeGreaterThanOrEqual(0.371 * colors.length); // 99% confidence interval
        expect(blueCount).toBeLessThanOrEqual(0.629 * colors.length);
        const sizeTestSet = new Set(sizes);
        expect(sizeTestSet).toStrictEqual(new Set(["small", "big"]));
        const bigCount = sizes.filter(s => s === "big").length;
        expect(bigCount).toBeGreaterThanOrEqual(0.371 * sizes.length);
        expect(bigCount).toBeLessThanOrEqual(0.629 * sizes.length);
        const numberTestSet = new Set(numbers);
        expect(numberTestSet).toStrictEqual(new Set([1,2,3,4,6,7,8,9]));
        for (let i=1; i<10; i++) {
            if (i == 5) continue;
            const numCount = numbers.filter(num => num == i).length;
            // each number should be ~ 1/8 of total numbers, so if one
            // is < 1/16 or > 2/8 we probably have a problem
            expect(numCount).toBeGreaterThanOrEqual(.0625 * numbers.length);
            expect(numCount).toBeLessThanOrEqual(.250 * numbers.length);
        }
    });
});

function taskType(stimulus) {
    stimulus = stimulus.replace("&gt;", ">").replace("&lt;", "<");
    const fontSizePat = /<span class="(smalldot|dot white)"><\/span><span class="(smalldot|dot white)"><\/span>/;
    const numberPat = /(>5|<5)<\/span> <span>(<5|>5)/;
    const colorPat = /<span class="dot .*"><\/span><span class="dot .*"><\/span>/;
    if (stimulus.match(fontSizePat)) {
        return "font size";
    }
    if (stimulus.match(numberPat)) {
        return "number";
    }
    if (stimulus.match(colorPat)) {
        return "color";
    }
    return "unknown";
}

describe("TaskSwitching for exercise block", () => {
    beforeEach(() => {
        jest.useFakeTimers("legacy");
        const tl = (new TaskSwitching(1)).getTimeline();
        jsPsych.init({timeline: [tl[12]] }); // 12 is the first exercise block
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it("should tell users they answered correctly when they respond to an exercise block cue correctly", () => {
        doTrial(true);
         // fixation -> feedback
         jest.advanceTimersByTime(501);
         expect(jsPsych.getDisplayElement().innerHTML).toMatch(/Correct/);
     });
     it("should tell users they answered incorrectly when they respond to an exercise block cue incorrectly", () => {
         doTrial(false);
         // fixation -> feedback
         jest.advanceTimersByTime(501);
         expect(jsPsych.getDisplayElement().innerHTML).toMatch(/Incorrect/);
     });
});

describe("TaskSwitching", () => {
    beforeEach(() => {
        jest.useFakeTimers("legacy");
        jsPsych.init({
            timeline: (new TaskSwitching(1)).getTimeline()
        });
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it("should loop instructional screens until participants get them right", () => {
        // Intro -> first training trial
        pressKey(" ");
        // training trials always use 2, 2 < 5, >5 is assigned to right arrow, so right arrow is incorrect
        pressKey("ArrowRight");
        expect(jsPsych.getDisplayElement().innerHTML).toMatch(/Incorrect/);
        // Incorrect -> first training trial
        pressKey(" ");
        expect(jsPsych.getDisplayElement().innerHTML).toMatch(/Is the number presented on the screen less than or greater than 5/);
        pressKey("ArrowLeft");
        expect(jsPsych.getDisplayElement().innerHTML).toMatch(/That is the correct answer/);
    });
    it("should tell users to respond faster if they don't respond to a cue within 2500ms", () => {
        doTraining();

        // fixation -> blue/yellow prompt display
        jest.advanceTimersByTime(201);

        // blue/yellow prompt display -> stimulus
        jest.advanceTimersByTime(501);
        
        // stimulus -> fixation via timeout
        jest.advanceTimersByTime(2501);
        // fixation -> feedback
        jest.advanceTimersByTime(501);
        expect(jsPsych.getDisplayElement().innerHTML).toMatch(/Answer faster next time/);
    });
    it("should not give users correct/incorrect feedback if the trial is not part of the exercise block", () => {
        doFirstTrial(true);
        // fixation -> next trial fixation
        jest.advanceTimersByTime(501);
        expect(jsPsych.getDisplayElement().innerHTML).not.toMatch(/Correct/);
    });
    it("should have at least one result marked isRelevant", () => {
        doFirstTrial(false);
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.isRelevant).toBe(true);
    });
    it("should mark correct responses as correct in the data field", () => {
        doFirstTrial(true);
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.correct).toBe(true);
    });
    it("should mark incorrect responses as incorrect in the data field", () => {
        doFirstTrial(false);
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.correct).toBe(false);
    });
    it("should include the stimulus size in the data field", () => {
        const [_number, size, _color] = doFirstTrial(true);
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.size).toBe(size);
    });
    it("should include the stimulus color in the data field", () => {
        const [_number, _size, color] = doFirstTrial(true);
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.color).toBe(color);
    });
    it("should include the stimulus number in the data field", () => {
        const [number, _size, _color] = doFirstTrial(true);
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.number).toBe(number);
    });
    it("should include the task type in the data field", () => {
        doFirstTrial(true);
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.taskType === "color" || data.taskType === "size" || data.taskType === "number").toBeTruthy();
    });
    it("should include the block type in the data field", () => {
        doFirstTrial(true);
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.blockType).toBe("single"); // the first trial is always single
    });
    it("should not include the round in the data field for trials where the block type is not 'mixed'", () => {
        doFirstTrial(true);
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.blockType).not.toEqual("mixed");
        expect(data.round).not.toBeDefined();
    });
    it("should include the round in the data field for trials where the block type is 'mixed'", () => {
        doTraining();
        // get through all of the color/size/value intro trials
        for (let i=0; i<3; i++) {
            for(let j=0; j<34; j++) {
                doTrial(false, true);
            }
            pressKey(" ");
        }
        // do the exercise nodes
        for (let i=0; i<16; i++) {
            doTrial(false, true, true);
        }
        pressKey(" ");
        doTrial(false, false); // first mixed trial
        const data = jsPsych.data.get().last(1).values()[0];
        expect(data.blockType).toEqual("mixed");
        expect(data.round).toEqual(1);
    });
    describe("trial structure should consist of", () => {
        const dispElem = jsPsych.getDisplayElement;
        it("a 500ms picture describing the type of task", () => {
            doTraining();
            const taskDescHtml = dispElem().innerHTML;
            const stimType = taskType(taskDescHtml);
            expect(stimType === "color" || stimType === "font size" || stimType === "number").toBeTruthy();
            jest.advanceTimersByTime(500);
            expect(dispElem().innerHTML).not.toEqual(taskDescHtml);
        });
        it("followed by a 2500ms number above the picture", () => {
            doTraining();
            jest.advanceTimersByTime(2999);
            const numHtml = dispElem().innerHTML;
            expect(numHtml).toMatch(/<p>[1-9]<\/p>/);
            jest.advanceTimersByTime(1);
            expect(dispElem().innerHTML).not.toEqual(numHtml);
        });
        it("followed by a 500ms fixation point", () => {
            doTraining();
            jest.advanceTimersByTime(3499);
            const fixHtml = dispElem().innerHTML;
            expect(fixHtml).toMatch(/<div class="fix">+/);
            jest.advanceTimersByTime(1);
            expect(dispElem().innerHTML).not.toEqual(fixHtml);
        });
        it("followed by a 500ms feedback screen", () => {
            doTraining();
            jest.advanceTimersByTime(3999);
            const feedbackHtml = dispElem().innerHTML;
            expect(feedbackHtml).toMatch(/Answer faster/);
            jest.advanceTimersByTime(1);
            expect(dispElem().innerHTML).not.toEqual(feedbackHtml);
        });
    });
});


// Goes from first intro screen to first fixation display in first block
function doTraining() {
    // Intro -> first training trial
    pressKey(" ");
    // training trial 1 -> training trial 1 feedback
    pressKey("ArrowLeft");

    // training trial 1 feedback -> training trial 2
    pressKey(" ");

    // training trial 2 -> training trial 2 feedback
    let [_stimulus, _number, size, color] = stimulusNumberSizeAndColor(jsPsych.getDisplayElement().innerHTML);
    if (color === "blue") {
        pressKey("ArrowLeft");
    } else {
        pressKey("ArrowRight");
    }
    // training trial 2 feedback -> training trial 3
    pressKey(" ");

    // training trial 3 -> training trial 3 feedback
    [_stimulus, _number, size, color] = stimulusNumberSizeAndColor(jsPsych.getDisplayElement().innerHTML);
    if (size === "small") {
        pressKey("ArrowLeft");
    } else {
        pressKey("ArrowRight");
    }

    // training trial 3 feedback -> ready screen
    pressKey(" ");

    // ready screen -> upcoming task description
    pressKey(" ");

    // upcoming task description -> task type promopt
    pressKey(" ");
}

function stimulusNumberSizeAndColor(dispElemHtml) {
    const classPat = /<div class="(big|small) (blue|ylw)">/;
    const match = dispElemHtml.match(classPat);
    const size = match[1];
    expect(size === "big" || size === "small").toBe(true);
    const color = match[2];
    expect(color === "blue" || color === "ylw").toBe(true);
    const numberPat = /<p>([1-4,5-9])<\/p>/;
    const numMatch = dispElemHtml.match(numberPat);
    const number = Number.parseInt(numMatch[1]);
    expect(number).toBeGreaterThanOrEqual(1);
    expect(number).toBeLessThanOrEqual(9);
    expect(number).not.toBe(5);
    const stimType = taskType(dispElemHtml);
    return [stimType, number, size, color];
}

// Does all of the training and then the first trial
// (correctly or not, as per correctly param)
// Assumes that bLeft is true in our taskSwitching object
// Ends on post-trial fixation screen for first trial
function doFirstTrial(correctly) {
    doTraining();

    const [number, size, color] = doTrial(correctly);
    return [number, size, color];
}

function doTrial(correctly, fully=false, isExerciseNode=false) {
    // prompt display -> stimulus
    jest.advanceTimersByTime(501);
    
    // stimulus -> fixation
    const [stimulus, number, size, color] = stimulusNumberSizeAndColor(jsPsych.getDisplayElement().innerHTML);
    switch(stimulus) {
        case "color":
            if ( (correctly && color === "blue") || (!correctly && color !== "blue")) {
                pressKey("ArrowLeft");
            } else {
                pressKey("ArrowRight");
            }
            break;
        case "font size":
            if ( (correctly && size === "big") || (!correctly && size !== "big")) {
                pressKey("ArrowRight");
            } else {
                pressKey("ArrowLeft");
            }
            break;
        case "number":
            if ( (correctly && number > 5) || (!correctly && number < 5)) {
                pressKey("ArrowRight");
            } else {
                pressKey("ArrowLeft");
            }
            break;
        default:
            throw new Error(`Unknown stimulus type '${stimulus}'`);
    }

    if (fully) {
        // fixation -> feedback or next prompt
        jest.advanceTimersByTime(500);

        if (isExerciseNode) { // only exercise nodes show feedback and post-feedback fixation
            // feedback -> fixation
            jest.advanceTimersByTime(500);
            // fixation -> next prompt
            jest.advanceTimersByTime(200);
        }
    }

    return [number, size, color];
}