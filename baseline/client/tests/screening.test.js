require("@adp-psych/jspsych/jspsych.js");
import { Screening } from "../screening/screening.js";

describe("Screening Survey", () => {
    beforeEach(() => {
        const timeline = (new Screening()).getTimeline();
        expect(timeline.length).toBe(5);
        jsPsych.init({timeline: timeline});
    });

    describe("screen 1", () => {
        it.each([['first-name'], ['last-name'], ['email'], ['phone'], ['gender']])("should require %s", (elemId) => {
            fillScreen1Form();
            const elem = document.getElementById(elemId);
            elem.value = "";
            expect(formIsValid()).toBe(false);
        });
    });

    describe("screen 2", () => {
        const getToScreen = () => {
            fillScreen1Form();
            submitForm();
        };

        beforeEach(getToScreen);

        it("should display all of the expected questions in the expected order", () => {
            confirmExpectedQuestions(Screening.baseQuestions.map(q => q.prompt));
        });

        it("should require all of the questions to be answered", () => {
            confirmAllQuestionsRequired(Screening.baseQuestions.length);
        });

        it("should tell you you are not eligible if your answers don't meet the eligibility criteria", () => {
            checkEligibility(Screening.baseQuestions, () => {
                jsPsych.init({timeline: (new Screening()).getTimeline()});
                getToScreen();
            });
        });
    });

    it("should not display question about menstruation when the gender is male", () => {
        fillScreen1Form("male");
        submitForm();
        const dispElem = jsPsych.getDisplayElement();

        const displayedQuestions = [];
        dispElem.querySelectorAll(".jspsych-survey-multi-choice-question > p")
            .forEach(q => displayedQuestions.push(q.textContent));

        const expectedQuestions = Screening.baseQuestions.filter(q => q.name !== Screening.pregName).map(q => q.prompt);
        expect(displayedQuestions).toEqual(expectedQuestions);
    });

    it.each([['other'],['female']])("should display question about menstruation when the gender is %s", (gender) => {
        fillScreen1Form(gender);
        submitForm();
        const dispElem = jsPsych.getDisplayElement();

        const displayedQuestions = [];
        dispElem.querySelectorAll(".jspsych-survey-multi-choice-question > p")
            .forEach(q => displayedQuestions.push(q.textContent));

        const expectedQuestions = Screening.baseQuestions.map(q => q.prompt);
        expect(displayedQuestions).toEqual(expectedQuestions);
    });

    describe("screen 3", () => {
        const getToScreen = () => {
            fillScreen1Form();
            submitForm();
            fillSurveyForm(Screening.baseQuestions);
            submitForm();
        };

        beforeEach(getToScreen);

        it("should display all of the expected questions in the expected order", () => {
            confirmExpectedQuestions(Screening.healthQuestions.map(q => q.prompt));
        });

        it("should require all of the questions to be answered", () => {
            confirmAllQuestionsRequired(Screening.healthQuestions.length);
        });

        it("should tell you you are not eligible if your answers don't meet the eligibility criteria", () => {
            checkEligibility(Screening.healthQuestions, () => {
                jsPsych.init({timeline: (new Screening()).getTimeline()});
                getToScreen();
            });
        });

    });

    describe("screen 4", () => {
        const getToScreen = () => {
            fillScreen1Form();
            submitForm();
            fillSurveyForm(Screening.baseQuestions);
            submitForm();
            fillSurveyForm(Screening.healthQuestions);
            submitForm();
        };

        beforeEach(getToScreen);

        it("should display all of the expected questions in the expected order", () => {
            confirmExpectedQuestions(Screening.mriQuestions.map(q => q.prompt));
        });

        it("should require all of the questions to be answered", () => {
            confirmAllQuestionsRequired(Screening.mriQuestions.length);
        });

        it("should tell you you are not eligible if your answers don't meet the eligibility criteria", () => {
            checkEligibility(Screening.mriQuestions, () => {
                jsPsych.init({timeline: (new Screening()).getTimeline()});
                getToScreen();
            });
        });

        it("should tell you you will be contacted if you are eligible", () => {
            fillSurveyForm (Screening.mriQuestions);
            submitForm();
            expect(document.body.innerHTML).toEqual(expect.stringContaining("contact you to tell you more about the study"));
        });
    });

});

function fillScreen1Form(gender="female") {
    document.getElementById("first-name").value = "John";
    document.getElementById("last-name").value = "Doe";
    document.getElementById("email").value = "jdoe@example.com";
    document.getElementById("phone").value = "12345678901";
    document.getElementById("gender").value = gender;
}

function fillSurveyForm(promptInfo) {
    const [yesAnswers, noAnswers] = getAnswers(promptInfo.length);
    const numQuestions = promptInfo.length;
    const rightAnswers = promptInfo.map(p => p.ok);
    for (let a=0; a<numQuestions; a++) {
        if (rightAnswers[a] === "yes") {
            yesAnswers[a].click();
        } else {
            noAnswers[a].click();
        }
    }
}

function submitForm() {
    const dispElem = jsPsych.getDisplayElement();
    const submitButton = dispElem.querySelector("input[type=submit]");
    expect(submitButton).not.toBe(null);
    submitButton.click();
}

function formIsValid(formId="jspsych-survey-html-form") {
    const form = document.getElementById(formId);
    expect(form).not.toBe(null);
    return form.checkValidity();
}

function confirmExpectedQuestions(expectedQuestions) {
    const dispElem = jsPsych.getDisplayElement();

    const displayedQuestions = [];
    dispElem.querySelectorAll(".jspsych-survey-multi-choice-question > p")
        .forEach(q => displayedQuestions.push(q.textContent));
    expect(displayedQuestions).toEqual(expectedQuestions);
}

function confirmAllQuestionsRequired(numQuestions) {
    const potentialAnswers =  [];
    for (let i=0; i<numQuestions; i++) {
        // this will just get the first answer option for each question
        potentialAnswers.push(document.getElementById(`jspsych-survey-multi-choice-response-${i}-0`));
    }
    expect(potentialAnswers.length).toBe(numQuestions);
    for (let q=0; q<numQuestions; q++) {
        for (let a=0; a<numQuestions; a++) {
            if (a !== q) potentialAnswers[a].click();
        }
        expect(formIsValid("jspsych-survey-multi-choice-form")).toBe(false);
        document.getElementById("jspsych-survey-multi-choice-form").reset();
    }
}

function checkEligibility(promptInfo, reloadFn) {
    const [yesAnswers, noAnswers] = getAnswers(promptInfo.length);
    const numQuestions = promptInfo.length;
    const rightAnswers = promptInfo.map(p => p.ok);
    for (let q=0; q<numQuestions; q++) {
        for (let a=0; a<numQuestions; a++) {
            if (rightAnswers[a] === "yes") {
                if (q != a) {
                    yesAnswers[a].click();
                } else {
                    noAnswers[a].click();
                }
            } else {
                if (q != a) {
                    noAnswers[a].click();
                } else {
                    yesAnswers[a].click();
                }
            }
        }
        submitForm();
        expect(document.body.innerHTML).toEqual(expect.stringContaining("You are not eligible"));
        // use the reload function to return to the state we were in at the start
        reloadFn();
    }
}

function getAnswers(numQuestions) {
    const yesAnswers =  [];
    const noAnswers = [];
    for (let i=0; i<numQuestions; i++) {
        // this will just get the first answer option for each question
        yesAnswers.push(document.getElementById(`jspsych-survey-multi-choice-response-${i}-0`));
        noAnswers.push(document.getElementById(`jspsych-survey-multi-choice-response-${i}-1`));
    }
    expect(yesAnswers.length).toBe(numQuestions);
    expect(noAnswers.length).toBe(numQuestions);
    return [yesAnswers, noAnswers];
}
