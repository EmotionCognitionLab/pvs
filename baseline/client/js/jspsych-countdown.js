jsPsych.plugins["countdown"] = (() => {
    const plugin = {};

    plugin.info = {
        name: "countdown",
        parameters: {
            duration: {
                type: jsPsych.plugins.parameterType.INT,
                default: undefined,
            },
            stimulusFormatter: {
                type: jsPsych.plugins.parameterType.FUNCTION,
                default: timestamp => `The next part of the experiment will start in ${timestamp}.`,
            },
        },
    };

    plugin.timestamp = ms => {
        const minutes = Math.max(Math.floor((ms / 1000) / 60), 0);
        const seconds = Math.max(Math.floor((ms / 1000) % 60), 0);
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    };

    plugin.trial = (display_element, trial) => {
        // build and show display HTML
        {
            let html = "";
            html += `<div id="jspsych-countdown-stimulus"></div>`;
            html += `<button type="button" id="jspsych-countdown-button" class="jspsych-btn" disabled>Continue</button>`;
            display_element.innerHTML = html;
        }
        const stimulus = document.getElementById("jspsych-countdown-stimulus");
        const button = document.getElementById("jspsych-countdown-button");
        // add listener to button
        button.addEventListener("click", () => {
            jsPsych.finishTrial({duration: trial.duration});
        });
        // start countdown
        const start = performance.now();
        let interval;
        const updateClock = () => {
            const remaining = start + trial.duration - performance.now();
            stimulus.textContent = trial.stimulusFormatter(plugin.timestamp(remaining));
            if (remaining <= 0) {
                button.disabled = false;
                clearInterval(interval);
            }
        };
        updateClock();
        interval = setInterval(updateClock, 100);
    };

    return plugin;
})();
