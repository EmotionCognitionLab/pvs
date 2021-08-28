import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-preload.js";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "./style.css";
import pre_exer_instr from "./frag/pre_exercise_instruction.html";
import pre_mix_instr from "./frag/pre_mixed_instruction.html";

export class TaskSwitching {
    constructor() {
        // blueLeft, bigLeft (big as in font and as in numeric value)
        this.bLeft = Math.random() < 0.5; // TODO find a better name
    }

    getTimeline() {
        const options = ["color", "number", "size"];
        const firstExercise = jsPsych.randomization.sampleWithoutReplacement(options, 1)[0];
        const exercises = [firstExercise];
        for (let i = 0; i < 15; i++) {
            const nextExercise = this.constructor.biasedPick(exercises[i], options);
            exercises.push(nextExercise);
        }
        const exerciseNodes = exercises.map(e => this.node("exercise", e, 1));
        const mixedNodes = [];
        for (let i = 0; i < 4; i++) {
            const mixed = jsPsych.randomization.sampleWithReplacement(options, 34);
            mixed.forEach(m => mixedNodes.push(this.node("mixed", m, 1, i + 1)));
            if (i < 3) {
                mixedNodes.push(this.constructor.waitTimeline);
            } else {
                mixedNodes.push(this.constructor.instruction("Task complete. Great job!<br><em>Press the space bar to finish</em>"));
            }
        }
        // hack to remove the black background we use for this task
        mixedNodes[mixedNodes.length - 1].on_finish = () => { document.body.classList.remove("blackbg"); }

        const genericIntro = "We are going to start a round of the task. Please respond as quickly as you can but try to avoid mistakes.";
        const colorIntro = genericIntro + this.singleBlockHtml("color");

        const sizeIntro = genericIntro + this.singleBlockHtml("size");

        const numberIntro = genericIntro + this.singleBlockHtml("number");

        const singles = jsPsych.randomization.shuffle([
            [this.constructor.instruction(colorIntro), this.node("single", "color", 34)], 
            [this.constructor.instruction(sizeIntro), this.node("single", "size", 34)],
            [this.constructor.instruction(numberIntro), this.node("single", "number", 34)]    
        ]).flat();
        
        const firstInst = this.constructor.instruction(this.instr1Html(2, "small"));
        // hack to set up the black background this task needs
        firstInst.on_load = () => { document.body.classList.add("blackbg"); }

        return [
            firstInst,
            this.instructionNode(this.instr2(2, "small")),
            this.instructionNode(this.instr3(2, "small")),
            this.instructionNode(this.instr4(2, "big")),
            this.constructor.instruction("<p>That’s the basic task! Simple, right? Ready to start the real task?</p><em>Please press the space bar to proceed.</em>"),
        ].concat(singles)
        .concat([this.constructor.instruction(pre_exer_instr)])
        .concat(exerciseNodes)
        .concat([this.constructor.instruction(pre_mix_instr)])
        .concat(mixedNodes)
    }

    number(num, bigOrSmall=null) {
        if (!num) {
            num = jsPsych.randomization.sampleWithReplacement([1,2,3,4,6,7,8,9], 1)[0];
        }
        const color = Math.random() < 0.5 ? "blue" : "ylw";
        let size;
        if (!bigOrSmall || (bigOrSmall !== "big" && bigOrSmall !== "small")) {
            size = Math.random() < 0.5 ? "small" : "big";
        } else {
            size = bigOrSmall;
        }
        
        return {
            number: num,
            color: color,
            size: size
        }
    }

    promptHtml(taskType) {
        switch (taskType) {
            case "color":
                const dotColors = this.bLeft ? ["blue", "ylw"] : ["ylw", "blue"];
                return `<span class="dot ${dotColors[0]}"></span><span class="dot ${dotColors[1]}"></span>`;
            case "size":
                const dotOrder = this.bLeft ? ["dot white", "smalldot"] : ["smalldot", "dot white"];
                return `<span class="${dotOrder[0]}"></span><span class="${dotOrder[1]}"></span>`;
            case "number":
                const numberOrder = this.bLeft ? [">5", "<5"] : ["<5", ">5"];
                return `<div class="small"><span class="leftVal">${numberOrder[0]}</span> <span>${numberOrder[1]}</span></div>`;
            default:
                throw new Error(`Can't create a prompt for unknown task type '${taskType}'`);
        }
    }

    correctResponse(taskType, cue) {
        switch(taskType) {
            case "color":
                if (this.bLeft) {
                    if (cue.color === "blue") {
                        return "arrowleft"
                    } else {
                        return "arrowright"
                    }
                } else {
                    if (cue.color === "blue") {
                        return "arrowright"
                    } else {
                        return "arrowleft"
                    }
                }
            case "size":
                if (this.bLeft) {
                    if (cue.size === "big") {
                        return "arrowleft"
                    } else {
                        return "arrowright"
                    }
                } else {
                    if (cue.size === "big") {
                        return "arrowright"
                    } else {
                        return "arrowleft"
                    }
                }
            case "number":
                if (this.bLeft) {
                    if (cue.number > 5) {
                        return "arrowleft"
                    } else {
                        return "arrowright"
                    }
                } else {
                    if (cue.number > 5) {
                        return "arrowright"
                    } else {
                        return "arrowleft"
                    }
                }
            default:
                throw new Error(`Can't determine correct response for unknown stimulus type '${taskType}'`);
        }
    }

    prompt(taskType) {
        return {
            type: "html-keyboard-response",
            stimulus: this.promptHtml(taskType),
            trial_duration: 500,
            choices: jsPsych.NO_KEYS
        }
    }

    trial(blockType, taskType, round=null) {
        const prompt = this.promptHtml(taskType);
        const corrRespFn = this.correctResponse.bind(this);
        const result = {
            type: "html-keyboard-response",
            stimulus: function() {
                let stim = `<div class="${jsPsych.timelineVariable("size")} ${jsPsych.timelineVariable("color")}">`;
                stim += "<p>" + jsPsych.timelineVariable("number") + "</p>";
                stim += "</div>";
                stim += prompt;
                return stim;
            },
            trial_duration: 2500,
            choices: ["ArrowRight", "ArrowLeft"],
            data: {
                isRelevant: true,
                color: jsPsych.timelineVariable("color"),
                size: jsPsych.timelineVariable("size"),
                number: jsPsych.timelineVariable("number"),
                bLeft: this.bLeft,
                taskType: taskType,
                blockType: blockType
            },
            on_finish: function(data){
                const correctResponse = corrRespFn(taskType, {
                    color: data.color,
                    size: data.size,
                    number: data.number
                });
                data.correct = data.response === correctResponse;
            }
        }
        // round is for mixed blocks only and refers to which of the four rounds we're on
        if (round !== null) {
            result.data.round = round;
        }
        return result;
    }

    node(blockType, taskType, repetitions, round=null) {
        const timelineVariables = [];
        for (let i = 0; i < repetitions; i++) {
            timelineVariables.push(this.number());
        }
        return {
            timeline: [this.constructor.fixation(200), this.prompt(taskType), this.trial(blockType, taskType, round), this.constructor.fixation(500), this.constructor.feedback],
            timeline_variables: timelineVariables,
        }
    }

    instr1Html(number, size) {
        let text = "Ready to do a new task? In this task we will ask you to classify numbers using simple rules. You will see one number at a time, like this one:";
        const numberObj = this.number(number, size);
        text += `<div class="${numberObj.size} ${numberObj.color}"><p>${numberObj.number}</p></div>`;
        text += '<p>In addition to numbers, at the bottom of the screen, you will see the rule for that trial. Now let’s see what the rules are.</p>'
        text += "<em>Press the space bar to continue</em>"
        return text;
    }

    instr2(number, size) {
        const correctResponse = this.correctResponse("number", {number: number});
        const numObj = this.number(number, size);
        let stim = `<div class="${numObj.size} ${numObj.color}">`;
        stim += "<p>" + numObj.number + "</p>";
        stim += "</div>";
        stim += this.promptHtml("number");
        stim += `<p>Is the number presented on the screen less than or greater than 5? Please press the ${this.bLeft ? "right": "left"} arrow key if the number is less than 5 and the ${this.bLeft ? "left": "right"} arrow key if the number is greater than 5.</p>`
        return {
            type: "html-keyboard-response",
            stimulus: stim,
            choices: ["ArrowRight", "ArrowLeft"],
            data: {
                isTraining: true
            },
            on_finish: function(data) {
                data.correct = data.response === correctResponse;
            }
        }
    }

    instr3(number, size) {
        const numObj = this.number(number, size);
        const correctResponse = this.correctResponse("color", {color: numObj.color});
        let stim = `<div class="${numObj.size} ${numObj.color}">`;
        stim += "<p>" + numObj.number + "</p>";
        stim += "</div>";
        stim += this.promptHtml("color");
        stim += `<p>Is the color of the number blue or yellow? Please press the ${this.bLeft ? "left": "right"} arrow key if the color is blue and the ${this.bLeft ? "right": "left"} arrow key if the color is yellow.</p>`
        return {
            type: "html-keyboard-response",
            stimulus: stim,
            choices: ["ArrowRight", "ArrowLeft"],
            data: {
                isTraining: true
            },
            on_finish: function(data) {
                data.correct = data.response === correctResponse;
            }
        }
    }

    instr4(number, size) {
        const numObj = this.number(number, size);
        const correctResponse = this.correctResponse("size", {size: numObj.size});
        let stim = `<div class="${numObj.size} ${numObj.color}">`;
        stim += "<p>" + numObj.number + "</p>";
        stim += "</div>";
        stim += this.promptHtml("size");
        stim += `<p> Is the number displayed in a small or big font? Please press the ${this.bLeft ? "right": "left"} arrow key if the font is small and the ${this.bLeft ? "left": "right"} arrow key if the font is large.</p>`
        return {
            type: "html-keyboard-response",
            stimulus: stim,
            choices: ["ArrowRight", "ArrowLeft"],
            data: {
                isTraining: true
            },
            on_finish: function(data) {
                data.correct = data.response === correctResponse;
            }
        }
    }

    instructionNode(trial) {
        return {
            timeline: [trial, this.constructor.trainingFeedback],
            loop_function: function(data) {
                const response = data.last(2).values()[0];
                return !response.correct;
            }
        }
    }

    singleBlockHtml(taskType) {
        let taskText;
        switch(taskType) {
            case "color":
                taskText = "whether they are yellow or blue";
                break;
            case "size":
                taskText = "their relative font size";
                break;
            case "number":
                taskText = "whether they are greater or less than 5";
                break;
            default:
                throw new Error(`Cannot define taskText for unknown taskType '${taskType}'`);
        }
        const html = `<p>In this round, you will be categorizing numbers on ${taskText}.</p>`;
        const prompt = this.promptHtml(taskType);
        return html + prompt + '<br/><div style="padding-top: 40px;""><em>Press the space bar when you are ready to begin</em></div>';
    }
}

TaskSwitching.taskName = "task-switching";

TaskSwitching.feedback = {
    type: "html-keyboard-response",
    stimulus: function() {
        const data = jsPsych.data.getLastTimelineData();
        const values = data.last(2).values()[0];
        if (values.response === null) {
            return "Answer faster next time";
        }
        if (values.correct) {
            return "Correct";
        }
        return "Incorrect";
    },
    choices: jsPsych.NO_KEYS,
    trial_duration: 500,
    css_classes: ["small"]
}

TaskSwitching.trainingFeedback = {
    type: "html-keyboard-response",
    stimulus: function() {
        const data = jsPsych.data.getLastTimelineData();
        const response = data.last(1).values()[0];
        if (response.correct) {
            return "<p>Excellent! That is the correct answer.</p><br/><em>Please press the space bar to continue.</em>";
        }
        return "<p>Incorrect. Please try again.</p><br/><em>Please press the space bar to continue.</em>";
    },
    choices: [" "],
    data: {
        isTraining: true
    }
}

TaskSwitching.fixation = function(durationMs) {
    return {
        type: "html-keyboard-response",
        stimulus: '<div class="fix">+</div><br/><span class="dot">',
        trial_duration: durationMs,
        choices: jsPsych.NO_KEYS
    }
}

/**
 * Returns either curItem (50% chance)
 * or one of allItems that is not curItem. curItem may appear in
 * allItems, but no more than once. The items in allItems
 * must be comparable using === so do not use this
 * with an array of objects or an array of arrays.
 */
TaskSwitching.biasedPick = function(curItem, allItems) {
    if (Math.random() < 0.5) {
        return curItem;
    }
    const alternates = jsPsych.randomization.sampleWithoutReplacement(allItems, 2);
    if (alternates[0] === curItem) {
        return alternates[1];
    }
    return alternates[0];
}

TaskSwitching.instruction = function(text, choices = [" "]) {
    return {
        type: "html-keyboard-response",
        stimulus: text,
        choices: choices
    }
}

TaskSwitching.wait = {
    type: "html-keyboard-response",
    stimulus: function() { return `<div class="small"><p>Time for a short break!</p> <br/> ${jsPsych.timelineVariable('timerVal')}</div>` },
    trial_duration: 1000,
    choices: jsPsych.NO_KEYS
}

TaskSwitching.waitTimeline = {
    timeline: [TaskSwitching.wait],
    timeline_variables: [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, "READY", "SET", "GO"].map(i =>  ({timerVal: i}))
}

if (window.location.href.includes(TaskSwitching.taskName)) {
    jsPsych.init({
        timeline: (new TaskSwitching(1)).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); }
    });
}