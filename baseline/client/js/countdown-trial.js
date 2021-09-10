export function countdownTrial(duration) {
    // from jodeleeuw's https://github.com/jspsych/jsPsych/discussions/1690
    const timestamp = ms => {
        const minutes = Math.max(Math.floor((ms / 1000) / 60), 0);
        const seconds = Math.max(Math.floor((ms / 1000) % 60), 0);
        return `${minutes}:${String(seconds).padStart(2, "0")}`;
    };
    return {
        type: "html-button-response",
        stimulus: `<p>The next part of the experiment will start in <span id="countdown-trial-clock">${timestamp(duration)}</span>.`,
        choices: ["Continue"],
        on_load: () => {
            const clock = document.getElementById("countdown-trial-clock");
            // disable button
            const button = document.querySelector(".jspsych-html-button-response-button");
            button.disabled = true;
            // start countdown
            const start = performance.now();
            const interval = setInterval(() => {
                const remaining = start + duration - performance.now();
                clock.textContent = timestamp(remaining);
                if (remaining <= 0) {
                    button.disabled = false;
                    clearInterval(interval);
                }
            }, 250);
        },
    };
}
