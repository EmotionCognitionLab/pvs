require("@adp-psych/jspsych/jspsych.js");
import { PhysicalActivity } from "../physical-activity/physical-activity.js";

describe("Physical Activity Survey", () => {
    beforeEach(() => {
        const timeline = (new PhysicalActivity()).getTimeline();
        expect(timeline.length).toBe(1);
        jsPsych.init({timeline: timeline});
    });

    it("should have at least one result marked isRelevant", () => {
        fillForm();
        const form = document.getElementById("jspsych-survey-html-form");
        expect(form).not.toBe(null);
        expect(formIsValid()).toBe(true);
        form.submit();

        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });

    it("should require a physical activity rating", () => {
        fillForm();
        const pa = document.getElementById("point2");
        pa.checked = false;
        expect(formIsValid()).toBe(false);
    });

    it("should require body weight", () => {
        fillForm();
        const weight = document.getElementById("weight");
        weight.value = "";
        expect(formIsValid()).toBe(false);
    });
    
    it("should require feet of height", () => {
        fillForm();
        const heightF = document.getElementById("height_feet");
        heightF.value = "";
        expect(formIsValid()).toBe(false);
    });
    
    it("should require inches of height", () => {
        fillForm();
        const heightI = document.getElementById("height_inches");
        heightI.value = "";
        expect(formIsValid()).toBe(false);
    });
    
    it("should require age", () => {
        fillForm();
        const age = document.getElementById("age");
        age.value = "";
        expect(formIsValid()).toBe(false);
    });
    
    it("should require gender", () => {
        fillForm();
        const gender = document.getElementById("gender");
        gender.value = "";
        expect(formIsValid()).toBe(false);
    });
});

function fillForm() {
    document.getElementById("point2").click();

    document.getElementById("weight").value = "135";
    document.getElementById("height_feet").value = "5";
    document.getElementById("height_inches").value = "9";
    document.getElementById("age").value = "71";
    document.getElementById("gender").value = "1";
}

function formIsValid() {
    const form = document.getElementById("jspsych-survey-html-form");
    expect(form).not.toBe(null);
    return form.checkValidity();
}
