jsPsych.plugins["memory-field"] = (() => {
    const plugin = {};

    plugin.info = {
        name: "memory-field",
        parameters: {
            stimulus: {
                type: jsPsych.plugins.parameterType.HTML_STRING,
                default: undefined,
            },
            button_label: {
                type: jsPsych.plugins.parameterType.STRING,
                default: "Stop",
            },
        },
    };

    plugin.trial = (display_element, trial) => {
        // build and show display HTML
        {
            let html = "";
            html += `<div id="jspsych-memory-field-stimulus">${trial.stimulus}</div>`;
            html += `<input type="text" id="jspsych-memory-field-field">`;
            html += `<input type="button" id="jspsych-memory-field-button" class="jspsych-btn" value="${trial.button_label}">`;
            display_element.innerHTML = html;
        }
        // find important elements
        const field = display_element.querySelector("#jspsych-memory-field-field");
        const button = display_element.querySelector("#jspsych-memory-field-button");
        // add field listener
        const memory = [];
        field.addEventListener("keyup", event => {
            event.preventDefault();
            if (event.code === "Enter") {
                // save value and clear field
                memory.push(event.target.value);
                event.target.value = "";
                // flash to confirm submission
                field.classList.add("jspsych-memory-field-flash");
                setTimeout(() => {
                    field.classList.remove("jspsych-memory-field-flash");
                }, 250);
            }
        });
        // add button listener
        button.addEventListener("click", () => {
            const data = {
                stimulus: trial.stimulus,
                response: memory,
            };
            jsPsych.finishTrial(data);
        });
    };

    return plugin;
})();