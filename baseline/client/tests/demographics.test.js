require("@adp-psych/jspsych/jspsych.js");
import { Demographics } from "../demographics/demographics.js";

describe("Demographics", () => {
    beforeEach(() => {
        const timeline = (new Demographics()).getTimeline();
        expect(timeline.length).toBe(1);
        jsPsych.init({timeline: timeline});
    });

    it("should have at least one result marked isRelevant", () => {
        fillMinimumForm();
        const dispElem = jsPsych.getDisplayElement();
        const submitButton = dispElem.querySelector("input[type=submit]");
        expect(submitButton).not.toBe(null);
        submitButton.click();

        // check the data
        const relevantData = jsPsych.data.get().filter({isRelevant: true}).values();
        expect(relevantData.length).toBe(1);
    });

    it("should set the other race input to be enabled and required if other race is selected", () => {
        const otherRaceText = document.getElementById("o_text");
        checkRequiredAndDisabledAttrs([otherRaceText], false);
        const otherRace = document.getElementById("o");
        otherRace.click();
        checkRequiredAndDisabledAttrs([otherRaceText], true);
    });

    it("should set both biracial inputs to be enabled and required if biracial is selected", () => {
        const bi1Text = document.getElementById("bi1_text");
        const bi2Text = document.getElementById("bi1_text");
        checkRequiredAndDisabledAttrs([bi1Text, bi2Text], false);
        const biRacial = document.getElementById("bi");
        biRacial.click();
        checkRequiredAndDisabledAttrs([bi1Text, bi2Text], true);
    });

    it("should set other race text to be disabled and not required if an alternate race is selected", () => {
        const otherRace = document.getElementById("o");
        otherRace.click();
        const otherRaceText = document.getElementById("o_text");
        checkRequiredAndDisabledAttrs([otherRaceText], true);
        const americanIndian = document.getElementById("ai");
        americanIndian.click();
        checkRequiredAndDisabledAttrs([otherRaceText], false);
    });

    it("should set both biracial text fields to be disabled and empty if an alternate race is selected", () => {
        const biRacial = document.getElementById("bi");
        biRacial.click();
        const bi1Text = document.getElementById("bi1_text");
        const bi2Text = document.getElementById("bi1_text");
        checkRequiredAndDisabledAttrs([bi1Text, bi2Text], true);
        const other = document.getElementById("o");
        other.click();
        checkRequiredAndDisabledAttrs([bi1Text, bi2Text], false);
    });

    it("should require a date of vaccination if you say you are vaccinated", () => {
        const firstDose = document.getElementById("1stdose");
        expect(firstDose.required).toBe(false);
        const vaxed = document.getElementById("covidVaxY");
        vaxed.click();
        expect(firstDose.required).toBe(true);
    });

    it("should require you to say which psychiatric disorder if you say you've been diagnosed with one", () => {
        const psychDiagWhich = document.getElementById("psychDiagWhich");
        expect(psychDiagWhich.required).toBe(false);
        const psychDiagY = document.getElementById("psychDiagY");
        psychDiagY.click();
        expect(psychDiagWhich.required).toBe(true);
    });

    it("should not require you to say which psychiatric disorder you've been diagnosed with if you say you have not been diagnosed with one", () => {
        const psychDiagY = document.getElementById("psychDiagY");
        psychDiagY.click();
        const psychDiagWhich = document.getElementById("psychDiagWhich");
        expect(psychDiagWhich.required).toBe(true);
        const psychDiagN = document.getElementById("psychDiagN");
        psychDiagN.click();
        expect(psychDiagWhich.required).toBe(false);
    });

    it("should require you to say which other disease if you say you've been diagnosed with other", () => {
        const which = document.getElementById("otherDiseaseWhich");
        checkRequiredAndDisabledAttrs([which], false);
        const other = document.getElementById("otherDisease");
        other.click();
        checkRequiredAndDisabledAttrs([which], true);
    });

    it("should not require you to say which other disease if you uncheck other", () => {
        const other = document.getElementById("otherDisease");
        other.click();
        const which = document.getElementById("otherDiseaseWhich");
        checkRequiredAndDisabledAttrs([which], true);
        other.click();
        checkRequiredAndDisabledAttrs([which], false);
    });

    it("should require you to say if you're currently on estrogen replacement if you say you've ever taken it", () => {
        const estReplCurrentY = document.getElementById("estrogenReplacementCurrentY");
        expect(estReplCurrentY.required).toBe(false);
        const estReplEverY = document.getElementById("estrogenReplacementMedY");
        estReplEverY.click();
        expect(estReplCurrentY.required).toBe(true);
    });

    it("should not require you to say if you're currently on estrogen replacement if you say you've never taken it", () => {
        const estReplEverY = document.getElementById("estrogenReplacementMedY");
        estReplEverY.click();
        const estReplCurrentY = document.getElementById("estrogenReplacementCurrentY");
        expect(estReplCurrentY.required).toBe(true);
        const estReplEverN = document.getElementById("estrogenReplacementMedN");
        estReplEverN.click();
        expect(estReplCurrentY.required).toBe(false);
    });

    it("should not allow you to submit the form if you say you have diabetes but don't specify which type(s)", () => {
        fillMinimumForm();
        document.getElementById("diabetes").click();
        const submitButton = document.querySelector("input[type=submit]");
        submitButton.click();
        const data = jsPsych.data.get().values();
        expect(data.length).toBe(0);
        expect(jsPsych.getDisplayElement()).toBeDefined();
    });

    it("should allow you to submit the form if you say you have diabetes and specify which type(s)", () => {
        fillMinimumForm();
        document.getElementById("diabetes").click();
        document.getElementById("preDiabetes").click();
        const submitButton = document.querySelector("input[type=submit]");
        submitButton.click();
        const data = jsPsych.data.get().values();
        expect(data.length).toBe(1);
        const dispElem = jsPsych.getDisplayElement();
        expect(dispElem.children.length).toBe(0);
    });

    it("should not allow you to submit the form if you don't choose at least one item in the doctor's care section", () => {
        fillMinimumForm();
        const doctorElems = document.getElementById("doctor-question").getElementsByTagName("input");
        for (let i=0; i<doctorElems.length; i++) {
            const cb = doctorElems[i];
            if (cb.getAttribute("type") === "checkbox") cb.checked = false;
        }

        const submitButton = document.querySelector("input[type=submit]");
        submitButton.click();
        const data = jsPsych.data.get().values();
        expect(data.length).toBe(0);
        expect(jsPsych.getDisplayElement()).toBeDefined();
    });

    it("should not allow you to submit the form if you don't choose at least one item in the drugs section", () => {
        fillMinimumForm();
        const drugElems = document.getElementById("drugs-question").getElementsByTagName("input");
        for (let i=0; i<drugElems.length; i++) {
            const cb = drugElems[i];
            if (cb.getAttribute("type") === "checkbox") cb.checked = false;
        }

        const submitButton = document.querySelector("input[type=submit]");
        submitButton.click();
        const data = jsPsych.data.get().values();
        expect(data.length).toBe(0);
        expect(jsPsych.getDisplayElement()).toBeDefined();
    });
});

function checkRequiredAndDisabledAttrs(elemList, required) {
    elemList.forEach(elem => {
        expect(elem.required).toBe(required);
        expect(elem.disabled).toBe(!required);
    });
}

function fillMinimumForm() {
    const clickIds = ["aa", "ethH", "retiredN", "covidVaxN", "everSmokedY", "psychDiagN", "heartDisease", "thyroidMed"];
    clickIds.forEach(elem => document.getElementById(elem).click());

    document.getElementById("educationYears").value = 2;
    document.getElementById("profession").value = "typist";
    document.getElementById("weeklyAlcoholicDrinks").value = 2;
}
