jsPsych.plugins["timed-writing"] = (() => {
    const plugin = {};

    plugin.info = {
        name: "timed-writing",
        parameters: {
            duration: {
                type: jsPsych.plugins.parameterType.INT,
                default: undefined,
            },
            stimulus: {
                type: jsPsych.plugins.parameterType.HTML_STRING,
                default: undefined,
            },
            textarea_rows: {
                type: jsPsych.plugins.parameterType.INT,
                default: undefined,
            },
            textarea_cols: {
                type: jsPsych.plugins.parameterType.INT,
                default: undefined,
            },
            show_timer: {
                type: jsPsych.plugins.parameterType.BOOL,
                default: true,
            }
        },
    };

    plugin.trial = (display_element, trial) => {
        // build and show display HTML
        {
            let html = "";
            html += `<div id="jspsych-timed-writing-stimulus">${trial.stimulus}</div>`;
            const [r, c] = [trial.textarea_rows, trial.textarea_cols];
            html += `<textarea id="jspsych-timed-writing-textarea" rows="${r}" cols="${c}" autocomplete="off" autocapitalize="none" spellcheck="false" autocorrect="off"></textarea>`;
            html += `<div id="jspsych-timed-writing-timer"></div>`;
            display_element.innerHTML = html;
            document.querySelector("#jspsych-timed-writing-timer").hidden = !trial.show_timer;
            document.querySelector("#jspsych-timed-writing-textarea").focus();
        }
        // start display timer to show remaining time
        {
            let clock_seconds = Math.floor(trial.duration / 1000) - 1;
            (function update_clock() {
                const clock = document.querySelector("#jspsych-timed-writing-timer");
                if (clock !== null && clock_seconds >= 0) {
                    clock.textContent = `${clock_seconds} s`;
                    --clock_seconds;
                    setTimeout(update_clock, 1000);
                }
            })();
        }
        // start logical timer to end trial
        setTimeout(() => {
            const data = {
                stimulus: trial.stimulus,
                response: document.querySelector("#jspsych-timed-writing-textarea").value,
            };
            display_element.innerHTML = "";
            jsPsych.finishTrial(data);
        }, trial.duration);
    };

    return plugin;
})();
