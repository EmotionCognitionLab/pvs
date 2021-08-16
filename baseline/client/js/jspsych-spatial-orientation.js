jsPsych.plugins["spatial-orientation"] = (() => {
    const plugin = {};

    plugin.info = {
        name: "spatial-orientation",
        parameters: {
            scene: {
                type: jsPsych.plugins.parameterType.HTML_STRING,
                default: undefined,
            },
            centerText: {
                type: jsPsych.plugins.parameterType.STRING,
                default: undefined,
            },
            topText: {
                type: jsPsych.plugins.parameterType.STRING,
                default: undefined,
            },
            pointerText: {
                type: jsPsych.plugins.parameterType.STRING,
                default: undefined,
            },
            targetAngle: {
                type: jsPsych.plugins.parameterType.FLOAT,
                default: undefined,
            },
        },
    };

    plugin.buildIcirc = (canvas, options) => {
        const ctx = canvas.getContext("2d");
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const pointerAngleFromMouseEvent = e => {
            // get coordinates on canvas
            const rect = canvas.getBoundingClientRect();
            const [x, y] = [e.clientX - rect.left, e.clientY - rect.top];
            return Math.atan2(centerY - y, x - centerX) - Math.PI/2;
        };
        const draw = (pointerAngle) => {
            window.requestAnimationFrame(() => {
                // clear
                ctx.fillStyle = "rgba(255, 255, 255, 1)";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "rgba(0, 0, 0, 1)";
                ctx.font = "16px sans-serif";
                ctx.textAlign = "center";
                // draw circle
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.arc(centerX, centerY, options.radius, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.fillText(options.centerText, centerX, centerY + 20);
                // draw arrow to top
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(centerX, centerY - options.radius);
                ctx.stroke();
                ctx.fillText(options.topText, centerX, centerY - options.radius - 20);
                // draw pointer
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(
                    centerX + options.radius * Math.cos(pointerAngle + Math.PI/2),
                    centerY - options.radius * Math.sin(pointerAngle + Math.PI/2)
                );
                ctx.stroke();
                ctx.fillText(
                    options.pointerText,
                    centerX + (options.radius+40) * Math.cos(pointerAngle + Math.PI/2),
                    centerY - (options.radius+40) * Math.sin(pointerAngle + Math.PI/2)
                );
            });
        };
        let running = true;
        canvas.addEventListener("mousemove", e => {
            if (running) {
                draw(pointerAngleFromMouseEvent(e));
            }
        });
        canvas.addEventListener("click", e => {
            if (running) {
                running = false;
                // build data
                const responseAngle = pointerAngleFromMouseEvent(e);
                const clickData = {
                    responseAngle: responseAngle,
                    targetAngle: options.targetAngle,
                };
                // draw target pointer
                ctx.setLineDash([]);
                ctx.strokeStyle = "rgba(255, 0, 0, 1)";
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(
                    centerX + options.radius * Math.cos(options.targetAngle + Math.PI/2),
                    centerY - options.radius * Math.sin(options.targetAngle + Math.PI/2)
                );
                ctx.stroke();
                // call onClick
                options.onClick(clickData);
            }
        });
        draw(0);
    };

    plugin.trial = (displayElement, trial) => {
        // build and show display HTML
        {
            let html = "";
            html += `<div id="jspsych-spatial-orientation-wrapper">`;
            html +=     `<div id="jspsych-spatial-orientation-scene">${trial.scene}</div>`;
            html +=     `<canvas id="jspsych-spatial-orientation-icirc" width="500" height="500"></canvas>`;
            html += `</div>`;
            displayElement.innerHTML = html;
        }
        const icirc = document.getElementById("jspsych-spatial-orientation-icirc");
        // check canvas support
        if (!icirc.getContext) { return; }
        const start = performance.now();
        plugin.buildIcirc(icirc, {
            radius: 150,
            centerText: trial.centerText,
            topText: trial.topText,
            pointerText: trial.pointerText,
            targetAngle: trial.targetAngle,
            onClick: clickData => {
                // build data
                const rt = performance.now() - start;
                const data = {
                    ...clickData,
                    rt: rt,
                };
                // finish trial
                setTimeout(() => { jsPsych.finishTrial(data); }, 1000);
            },
        });
    };

    return plugin;
})();
