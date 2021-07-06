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
            finish_duration: {
                type: jsPsych.plugins.parameterType.INT,
                default: 0,
            },
        },
    };

    plugin.trial = (display_element, trial) => {
        // build and show display HTML
        {
            let html = "";
            html += `<div id="jspsych-n-back-sequence">`;
            trial.sequence.forEach((c, idx) => {
                html += `<div id="jspsych-n-back-item-${idx}" class="jspsych-n-back-item">${c}</div>`
            });
            html += `</div>`;
            display_element.innerHTML = html;
        }
        // state
        let index;
        let trial_start;
        let focus_start;
        let interval;
        // helper to update state
        const focus_on = idx => {
            focus_start = performance.now();
            if (0 <= idx && idx < trial.sequence.length) {
                index = idx;
                const item = display_element.querySelector(`#jspsych-n-back-item-${idx}`);
                item.classList.add("jspsych-n-back-item-focused");
                setTimeout(() => {
                    item.classList.remove("jspsych-n-back-item-focused");
                }, trial.show_duration);
                return true;
            } else {
                index = -1;
                return false;
            }
        };
        // helpers to finish trial
        const is_correct = () => {
            if (trial.n === 0) {
                const item = trial.sequence[index];
                return item !== undefined && item === "1";
            } else {
                const a = trial.sequence[index];
                const b = trial.sequence[index - trial.n];
                return a !== undefined && b !== undefined && a === b;
            }
        };
        const finish = () => {
            const now = performance.now();
            clearInterval(interval);
            const selected = display_element.querySelector(`#jspsych-n-back-item-${index}`);
            if (selected !== null) {
                selected.classList.add("jspsych-back-item-selected");
            }
            setTimeout(() => {
                display_element.innerHTML = "";
                const data = {
                    n: trial.n,
                    sequence: trial.sequence,
                    response_index: index,
                    response_time_from_start: now - trial_start,
                    response_time_from_focus: now - focus_start,
                    correct: is_correct(),
                };
                jsPsych.finishTrial(data);
            }, trial.finish_duration);
        };
        // initialize state
        trial_start = performance.now();
        focus_on(0);
        // add interval
        interval = setInterval(() => {
            if (!focus_on(index + 1)) {
                finish();
            }
        }, trial.show_duration + trial.hide_duration);
        // add event listener
        document.addEventListener("keydown", event => {
            event.preventDefault();
            if (event.code === "Space") {
                finish();
            }
        }, {once: true});
    };

    return plugin;
})();
