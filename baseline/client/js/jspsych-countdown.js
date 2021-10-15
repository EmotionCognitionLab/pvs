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
        const divmod = (a, b) => [Math.floor(a / b), a % b];
        const [quoMinutes, modSeconds] = divmod(ms / 1000, 60);
        const [quoHours, modMinutes] = divmod(quoMinutes, 60);
        const zfloor = x => Math.max(Math.floor(x), 0);
        const h = String(zfloor(quoHours));
        const mm = String(zfloor(modMinutes)).padStart(2, "0");
        const ss = String(zfloor(modSeconds)).padStart(2, "0");
        return `${h}:${mm}:${ss}`;
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
