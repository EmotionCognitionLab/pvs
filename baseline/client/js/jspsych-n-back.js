jsPsych.plugins["n-back"] = (() => {
    const plugin = {};

    plugin.info = {
        name: "n-back",
        parameters: {
            n: {
                type: jsPsych.plugins.parameterType.INT,
                default: undefined,
            },
            sequence: {
                type: jsPsych.plugins.parameterType.STRING,
                array: true,
                default: undefined,
            },
            show_duration: {
                type: jsPsych.plugins.parameterType.INT,
                default: undefined,
            },
            hide_duration: {
                type: jsPsych.plugins.parameterType.INT,
                default: undefined,
            },
            hide_fixation: {
                type: jsPsych.plugins.parameterType.STRING,
                default: "+",
            },
        },
    };

    plugin.FLASH_DURATION = 250;  // .jspsych-n-back-flash animation duration in milliseconds

    plugin.is_correct = (n, sequence, index) => {
        if (n === 0) {
            const item = sequence[index];
            return item !== undefined && item === "1";
        } else {
            const a = sequence[index];
            const b = sequence[index - n];
            return a !== undefined && b !== undefined && a === b;
        }
    };

    plugin.trial = (display_element, trial) => {
        // build and show display HTML
        display_element.innerHTML = `<div id="jspsych-n-back-display"></div>`;
        const display = document.getElementById("jspsych-n-back-display");
        // state
        const responses = [];  // list of accrued responses
        let index = null;  // index of the current item in the sequence
        let trial_start;  // time since the trial started
        let focus_start;  // time since the current item was focused on
        let interval;  // identifier returned from setInterval
        let flash_timeout;  // identifier returned from setTimeout for the flash animation
        // helper for updating state
        const focus_next = () => {
            focus_start = performance.now();
            index = index === null ? 0 : index + 1;
            if (0 <= index && index < trial.sequence.length) {
                display.textContent = trial.sequence[index];
                display.classList.remove("jspsych-n-back-hidden");
                setTimeout(() => {
                    display.textContent = trial.hide_fixation;
                    display.classList.add("jspsych-n-back-hidden");
                }, trial.show_duration);
                return true;
            } else {
                index = -1;
                return false;
            }
        };
        // helper for recording response
        const listener_callback = event => {
            event.preventDefault();
            if (event.key === " " || event.code === "Space") {
                // add response data
                const now = performance.now();
                responses.push({
                    index: index,
                    time_from_start: now - trial_start,
                    time_from_focus: now - focus_start,
                    correct: plugin.is_correct(trial.n, trial.sequence, index),
                });
                // play .jspsych-n-back-flash animation (dark MDN magic)
                // https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Animations/Tips#run_an_animation_again
                display.classList.remove("jspsych-n-back-flash");
                window.requestAnimationFrame(() => {
                    window.requestAnimationFrame(() => {
                        display.classList.add("jspsych-n-back-flash");
                    });
                });
                // hide flash manually in case animation doesn't fade
                clearTimeout(flash_timeout);  // last flash's timeout shouldn't hide this flash
                setTimeout(() => {
                    display.classList.remove("jspsych-n-back-flash");
                }, plugin.FLASH_DURATION);
            }
        };
        // helper for finishing trial and cleanup
        const finish = () => {
            // clear interval, listener, and display
            clearInterval(interval);
            document.removeEventListener("keydown", listener_callback);
            display_element.innerHTML = "";
            // build data
            const missedIndices = [...trial.sequence.keys()]
                .filter(i => plugin.is_correct(trial.n, trial.sequence, i))
                .filter(i => !responses.some(r => r.index === i));
            const data = {
                n: trial.n,
                sequence: trial.sequence,
                responses: responses,
                missedIndices: missedIndices,
            };
            // finish trial
            jsPsych.finishTrial(data);
        };
        // initialize
        trial_start = performance.now();
        focus_next();
        interval = setInterval(() => {
            if (!focus_next()) {
                finish();
            }
        }, trial.show_duration + trial.hide_duration);
        document.addEventListener("keydown", listener_callback);
    };

    return plugin;
})();
