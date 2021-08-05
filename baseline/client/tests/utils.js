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
