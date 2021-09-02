jsPsych.plugins["spatial-orientation"] = (() => {
    const plugin = {};

    plugin.info = {
        name: "spatial-orientation",
        description: "responseAngle is the counterclockwise angle from the positive vertical. At the top, the angle starts at 0 and increases counterclockwise (on the left side of the circle) until it reaches +pi at the bottom. From the bottom, the angle wraps around to -pi and increases (on the right side of the circle) so that it reaches 0 again at the top.",
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

    plugin.angleABC = ([aX, aY], [bX, bY], [cX, cY]) => {
        // angle from vectors BA to BC
        const [baX, baY] = [aX - bX, aY - bY];
        const [bcX, bcY] = [cX - bX, cY - bY];
        const baNorm = Math.sqrt(baX*baX + baY*baY);
        const dx = (bcX*baX + bcY*baY) / baNorm;  // scalar projection of BC onto BA
        const dy = (bcY*baX - bcX*baY) / baNorm;  // scalar rejection of BC onto BA
        return Math.atan2(dy, dx);
    };

    plugin.buildIcirc = (canvas, options) => {
        const ctx = canvas.getContext("2d");
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const pointerAngleFromMouseEvent = e => {
            // get window coordinates on canvas
            const rect = canvas.getBoundingClientRect();
            const [wX, wY] = [e.clientX - rect.left, e.clientY - rect.top];
            // get vector coordinates relative to origin at center
            const [x, y] = [wX - centerX, centerY - wY];
            // get angle from positive vertical
            return plugin.angleABC([0, options.radius], [0, 0], [x, y]);
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
