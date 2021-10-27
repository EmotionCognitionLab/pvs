export function pressKey(key) {
    document.querySelector('.jspsych-display-element').dispatchEvent(new KeyboardEvent("keydown", {key: key}));
    document.querySelector('.jspsych-display-element').dispatchEvent(new KeyboardEvent("keyup", {key: key}));
}

export function clickContinue(querySelector="button") {
    const buttons = jsPsych.getDisplayElement().querySelectorAll(querySelector);
    expect(buttons.length).toBe(1);
    buttons[0].click();  // continue button
}

export function cartesianProduct(...arrays) {
    const reducer = (acc, array) => (
        acc.flatMap(sequence => array.map(item => [...sequence, item]))
    );
    return arrays.reduce(reducer, [[]]);
}

export function lastData(key) {
    const lastData = jsPsych.data.get().last(1).values()[0];
    if (key && lastData[key]) return lastData[key];
    return lastData;
}

export const clickIcirc = (icirc, x, y) => {
    const rect = icirc.getBoundingClientRect();
    icirc.dispatchEvent(new MouseEvent("click", {
        clientX: +x + icirc.width/2 + rect.left,
        clientY: -y + icirc.height/2 + rect.top,
    }));
};
