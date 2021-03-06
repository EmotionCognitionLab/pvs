jsPsych.plugins["percent-sum"] = (() => {
    const plugin = {};

    plugin.info = {
        name: "percent-sum",
        parameters: {
            preamble: {
                type: jsPsych.plugins.parameterType.HTML_STRING,
                default: undefined,
            },
            fields: {
                type: jsPsych.plugins.parameterType.STRING,
                array: true,
                default: undefined,
            },
            button_label: {
                type: jsPsych.plugins.parameterType.STRING,
                default: "Continue",
            },
        },
    };

    plugin.parseField = text => {
        if (text === "") {
            return NaN;
        } else if (Array.from(text).every(c => "0" <= c && c <= "9")) {
            return parseInt(text, 10);
        } else {
            return NaN;
        }
    };

    plugin.trial = (display_element, trial) => {
        // throw if fields are malformed
        if (trial.fields.length < 1) {
            throw new Error("fields must not be empty!");
        } else if ((new Set(trial.fields)).size !== trial.fields.length) {
            throw new Error("fields must not contain duplicates!");
        }
        // build and show display HTML
        {
            let html = "";
            html += `<div id="jspsych-percent-sum-preamble">${trial.preamble}</div>`;
            html += `<form id="jspsych-percent-sum-form">`;
            trial.fields.forEach(field => {
                html += `<label>${field}:`;
                html += `<input class="jspsych-percent-sum-field" type="number" name="${field}" min="0" max="100" value="0">`;
                html += `</label>`;
            });
            html += `<div id="jspsych-percent-sum-counter-wrapper">`
            html += `Total: <span id="jspsych-percent-sum-counter">0</span>%`
            html += `</div>`;
            html += `<input type="submit" id="jspsych-percent-sum-button" class="jspsych-btn" value="${trial.button_label}" disabled>`;
            html += `<form/>`;
            display_element.innerHTML = html;
        }
        // find important elements
        const form = display_element.querySelector("#jspsych-percent-sum-form");
        const inputs = display_element.querySelectorAll(".jspsych-percent-sum-field");
        const button = display_element.querySelector("#jspsych-percent-sum-button");
        const counter = display_element.querySelector("#jspsych-percent-sum-counter");
        // define validation helper for event listeners
        const percent_sum = () => {
            return Array.from(inputs).reduce((sum, inp) => sum + plugin.parseField(inp.value), 0);
        };
        // add input listeners
        inputs.forEach(inp => {
            inp.addEventListener("input", () => {
                const q = percent_sum();
                counter.textContent = String(q);
                if (q === 100) {
                    button.removeAttribute("disabled", "");
                    counter.classList.add("jspsych-percent-sum-counter-good");
                } else {
                    button.setAttribute("disabled", "");
                    counter.classList.remove("jspsych-percent-sum-counter-good");
                };
            });
        });
        // add submit listener
        form.addEventListener("submit", event => {
            event.preventDefault();
            // guarantee that response is valid
            if (percent_sum() === 100) {
                // build response object using input names as keys and input values as values
                const response = {};
                inputs.forEach(inp => {
                    response[inp.name] = parseInt(inp.value, 10);
                });
                // build data and finish trial
                const data = {
                    preamble: trial.preamble,
                    response: response,
                };
                jsPsych.finishTrial(data);
            } else {
                // fallback in case the button wasn't disabled
                window.alert("Fields must sum to 100%!");
            }
        });
    };

    return plugin;
})();
