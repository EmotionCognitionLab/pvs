let fragments;
fragload(new Map([
    ["introduction", "frag/introduction.html"],
    ["instruction", "frag/instruction.html"],
    ["completion", "frag/completion.html"],
])).then(frags => {
    fragments = frags;
    init();
}).catch(error => {
    document.body.textContent = `Error: failed to load HTML fragments! (${error})`;
});

const preload = {
    type: "preload",
    images: ["arrow.png"]
}

const introduction = {
    type: "html-keyboard-response",
    stimulus: () => fragments.get("introduction")
};

const instruction = {
    type: "html-keyboard-response",
    stimulus: () => fragments.get("instruction")
};

function flanker_stimulus(arrows) {
    head = "<div class=\"arrows\">";
    body = arrows.map(
        is_right => `<img class=${is_right ? "right" : "left"} src="arrow.png">`
    ).join("");
    tail = "</div><div><i>Press <b>f</b> or <b>j</b>.</i></div>";
    return head + body + tail;
}

function flanker_trial(arrows) {
    return {
        type: "html-keyboard-response",
        stimulus: () => flanker_stimulus(arrows),
        choices: ["f", "j"],
        data: { arrows: arrows }
    };
}

const completion = {
    type: "html-keyboard-response",
    stimulus: () => fragments.get("completion")
}

function init() {
    jsPsych.init({
        timeline: [
            preload,
            introduction,
            instruction,
            flanker_trial([1, 1, 1, 1, 1]),
            flanker_trial([0, 0, 0, 0, 0]),
            flanker_trial([1, 1, 0, 1, 1]),
            completion
        ],
        on_finish: () => { jsPsych.data.displayData("json"); }
    });
}
