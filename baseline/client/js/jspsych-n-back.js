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
            period: {
                type: jsPsych.plugins.parameterType.INT,
                default: undefined,
                description: "focus duration for each sequence element, in milliseconds",
            },
        },
    };

    plugin.trial = (display_element, trial) => {
        // build and show display HTML
        {
            let html = "";
            html += `<div id="jspsych-n-back-sequence">`;
            trial.sequence.forEach((str, index) => {
                html += `<div id="jspsych-n-back-item-${index}" class="jspsych-n-back-item">${str}</div>`
            });
            html += `</div>`;
            display_element.innerHTML = html;
        }
        // initialize state
        let index = 0;
        // add event listeners
        document.addEventListener("keydown", event => {
            event.preventDefault();
            if (event.code === "Space") {
                const data = {
                    n: trial.n,
                    sequence: trial.sequence,
                    response_index: undefined,
                    correct: undefined,
                };
                jsPsych.finishTrial(data);
            }
        }, {once: true});
    };

    return plugin;
})();
