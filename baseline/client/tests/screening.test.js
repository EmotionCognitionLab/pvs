require("@adp-psych/jspsych/jspsych.js");
import { Screening } from "../screening/screening.js";
import fetch from 'jest-mock-fetch';
global.fetch = fetch;

jest.mock('../../../common/logger/Logger', () => {
    return {
        Logger: jest.fn().mockImplementation(() => ({
            log: (msg, err) => console.log(msg, err),
            warn: (msg, err) => console.warn(msg, err),
            error: (msg, err) => console.error(msg, err),
        }))
    };
});

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
        const getToScreen = async () => {
            fillScreen1Form();
            await submitForm();
        };

        beforeEach(async () => await getToScreen());

        it("should display all of the expected questions in the expected order", () => {
            confirmExpectedQuestions(Screening.baseQuestions.map(q => q.prompt));
        });

        it("should require all of the questions to be answered", () => {
            confirmAllQuestionsRequired(Screening.baseQuestions.length);
        });

        it("should tell you you are not eligible if your answers don't meet the eligibility criteria", async () => {
            await checkEligibility(Screening.baseQuestions, async () => {
                jsPsych.init({timeline: (new Screening()).getTimeline()});
                await getToScreen();
            });
        });
    });

    it("should not display question about menstruation when the gender is male", async () => {
        fillScreen1Form("male");
        await submitForm();
        const dispElem = jsPsych.getDisplayElement();

        const displayedQuestions = [];
        dispElem.querySelectorAll(".jspsych-survey-multi-choice-question > p")
            .forEach(q => displayedQuestions.push(q.textContent));

        const expectedQuestions = Screening.baseQuestions.filter(q => q.name !== Screening.pregName).map(q => q.prompt);
        expect(displayedQuestions).toEqual(expectedQuestions);
    });

    it.each([['other'],['female']])("should display question about menstruation when the gender is %s", async (gender) => {
        fillScreen1Form(gender);
        await submitForm();
        const dispElem = jsPsych.getDisplayElement();

        const displayedQuestions = [];
        dispElem.querySelectorAll(".jspsych-survey-multi-choice-question > p")
            .forEach(q => displayedQuestions.push(q.textContent));

        const expectedQuestions = Screening.baseQuestions.map(q => q.prompt);
        expect(displayedQuestions).toEqual(expectedQuestions);
    });

    describe("screen 3", () => {
        const getToScreen = async () => {
            fillScreen1Form();
            await submitForm();
            fillSurveyForm(Screening.baseQuestions);
            await submitForm();
        };

        beforeEach(async () => await getToScreen());

        it("should display all of the expected questions in the expected order", () => {
            confirmExpectedQuestions(Screening.healthQuestions.map(q => q.prompt));
        });

        it("should require all of the questions to be answered", () => {
            confirmAllQuestionsRequired(Screening.healthQuestions.length);
        });

        it("should tell you you are not eligible if your answers don't meet the eligibility criteria", async () => {
            await checkEligibility(Screening.healthQuestions, async () => {
                jsPsych.init({timeline: (new Screening()).getTimeline()});
                await getToScreen();
            });
        });

    });

    describe("screen 4", () => {
        const getToScreen = async () => {
            fillScreen1Form();
            await submitForm();
            fillSurveyForm(Screening.baseQuestions);
            await submitForm();
            fillSurveyForm(Screening.healthQuestions);
            await submitForm();
        };

        beforeEach(async () => await getToScreen());

        it("should display all of the expected questions in the expected order", () => {
            confirmExpectedQuestions(Screening.mriQuestions.map(q => q.prompt));
        });

        it("should require all of the questions to be answered", () => {
            confirmAllQuestionsRequired(Screening.mriQuestions.length);
        });

        it("should tell you you are not eligible if your answers don't meet the eligibility criteria", async () => {
            await checkEligibility(Screening.mriQuestions, async () => {
                jsPsych.init({timeline: (new Screening()).getTimeline()});
                await getToScreen();
            });
        });

        it("should tell you you will be contacted if you are eligible", async () => {
            fillSurveyForm(Screening.mriQuestions);
            await submitForm();
            expect(document.body.innerHTML).toEqual(expect.stringContaining("you are eligible to participate"));
            const dateStr = (new Date()).toLocaleString('en-US', {year: 'numeric', month: 'numeric', day: 'numeric'});
            const expected = Object.assign({}, participantInfo);
            expected.date = dateStr;
            expect(fetch).toHaveBeenCalledWith(Screening.url, {
                method: "post",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-type": "application/json",
                },
                body: JSON.stringify(expected)
            });
        });
    });

});

const participantInfo = {
    "status": "eligible",
    "first-name": "John",
    "last-name": "Doe",
    "email": "jdoe@example.com",
    "phone": "12345678901",
    "gender": "female"
};

function fillScreen1Form(gender="female") {
    document.getElementById("first-name").value = participantInfo["first-name"];
    document.getElementById("last-name").value = participantInfo["last-name"];
    document.getElementById("email").value = participantInfo.email;
    document.getElementById("phone").value = participantInfo.phone;
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

async function submitForm() {
    const dispElem = jsPsych.getDisplayElement();
    const submitButton = dispElem.querySelector("input[type=submit]");
    expect(submitButton).not.toBe(null);
    await submitButton.click();
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

async function checkEligibility(promptInfo, reloadFn) {
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
        try {
            await submitForm();
        } catch (err) {
            console.error('error submitting form', err);
        }
        expect(fetch).toHaveBeenCalledWith(Screening.url, {
            method: "post",
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-type": "application/json",
            },
            body: '{"status": "ineligible"}'
        });
        expect(document.body.innerHTML).toEqual(expect.stringContaining("you are not eligible"));
        // use the reload function to return to the state we were in at the start
        await reloadFn();
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
