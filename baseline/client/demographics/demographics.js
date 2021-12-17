import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-html-form";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "./style.css";
import form_html from "./form.html";

export class Demographics {

    getTimeline() {
        const formTrial = {
            type: "survey-html-form",
            preamble: "<h2>Demographic Information</h2>",
            html: this.constructor.form,
            css_classes: ['demo'],
            on_load: this.constructor.setDynamicallyRequiredFields,
            data: {isRelevant: true}
        };
        
        return [formTrial];
    }

    get taskName() {
        return this.constructor.taskName;
    }
}

Demographics.taskName = "demographics";

Demographics.form = form_html;

Demographics.setDynamicallyRequiredFields = () => {
    document.getElementById("race-question").addEventListener("input", (event) => {
        if (event.target.type !== "radio") return;

        const otherText = document.getElementById("o_text");
        const bi1_text = document.getElementById("bi1_text");
        const bi2_text = document.getElementById("bi2_text");
        if (event.target.id === "o") {
            otherText.required = true;
            otherText.disabled = false;
            bi1_text.required = false;
            bi1_text.disabled = true;
            bi2_text.required = false;
            bi2_text.disabled = true;
        } else if (event.target.id === "bi") {
            otherText.required = false;
            otherText.disabled = true;
            bi1_text.required = true;
            bi1_text.disabled = false;
            bi2_text.required = true;
            bi2_text.disabled = false;
        } else {
            otherText.required = false;
            otherText.disabled = true;
            bi1_text.required = false;
            bi1_text.disabled = true;
            bi2_text.required = false;
            bi2_text.disabled = true;
        }
    });

    document.getElementById("vax-question").addEventListener("input", (event) => {
        if (event.target.type !== "radio") return;

        const dispStyle = event.target.id === "covidVaxY" ? "display: block;" : "display: none;";
        document.getElementById("vax-followup").style = dispStyle;
        document.getElementById("1stdose").required = event.target.id === "covidVaxY";
    });

    document.getElementById("psych-question").addEventListener("input", (event) => {
        if (event.target.type !== "radio") return;

        const dispStyle = event.target.id === "psychDiagY" ? "display: block;" : "display: none;";
        document.getElementById("psych-followup").style = dispStyle;
        const psychWhich = document.getElementById("psychDiagWhich");
        psychWhich.required = event.target.id === "psychDiagY";
        const psychNo = document.getElementById("psychDiagN").checked;
        if (psychNo) {
            psychWhich.value = "";
        }
    });

    document.getElementById("otherDisease").addEventListener("input", (event) => {
        const which = document.getElementById("otherDiseaseWhich");
        if (event.target.checked) {
            which.disabled = false;
            which.required = true;
        } else {
            which.disabled = true;
            which.value = "";
            which.required = false;
        }
    });

    document.getElementById("estrogen-question").addEventListener("click", (event) => {
        const targetId = event.target.id;
        if (targetId !== "estrogenReplacementMedY" && targetId !== "estrogenReplacementMedN") return;

        let dispStyle;
        let followupRequired;
        if (event.target.id === "estrogenReplacementMedY") {
            dispStyle = "display: block;";
            followupRequired = true;
        } else if (event.target.id === "estrogenReplacementMedN") {
            dispStyle = "display: none;";
            followupRequired = false;
        }
        document.getElementById("estrogen-followup").style = dispStyle;
        const estrogenCurrent = document.getElementById("estrogenReplacementCurrentY");
        estrogenCurrent.required = followupRequired;
    });

    const diabetesFollowupElems = [
        document.getElementById("type1"),
        document.getElementById("type2"),
        document.getElementById("preDiabetes")
    ];

    document.getElementById("diabetes").addEventListener("input", (event) => {
        const dispStyle =  event.target.checked ? "display: block;" : "display: none;";
        document.getElementById("diabetes-followup").style = dispStyle;
        if (!event.target.checked) {
            diabetesFollowupElems.forEach(cb => cb.checked = false);
        }
    });

    const doctorInputs = document.getElementById("doctor-question").getElementsByTagName("input");

    document.getElementById("doctor-question").addEventListener("input", (event) => {
        if (event.target.type === "checkbox" && event.target.checked) {
            if (event.target.id === "doctorNone") {
                for (let i=0; i<doctorInputs.length; i++) {
                    const cb = doctorInputs[i];
                    if (cb.id != event.target.id) cb.checked = false;
                }
            } else {
                document.getElementById("doctorNone").checked = false;
            }
        }
    });

    const drugInputs = document.getElementById("drugs-question").getElementsByTagName("input");

    document.getElementById("drugs-question").addEventListener("input", (event) => {
        if (event.target.type === "checkbox" && event.target.checked) {
            if (event.target.id === "noneMed") {
                for (let i=0; i<drugInputs.length; i++) {
                    const cb = drugInputs[i];
                    if (cb.id !== event.target.id) cb.checked = false;
                }
            } else {
                document.getElementById("noneMed").checked = false;
            }
        }
    });

    document.getElementById("jspsych-survey-html-form-next").addEventListener("click", (event) => {
        const diabetes = document.getElementById("diabetes");
        const diabetesFollowupComplete = diabetesFollowupElems.filter(elem => elem.checked).length > 0;
        if (diabetes.checked && !diabetesFollowupComplete) {
            const followupRequired = document.querySelector("#diabetes-followup div.required");
            followupRequired.style = "display: block";
            event.preventDefault();
        }

        const doctorComplete = Array.from(doctorInputs).filter(elem => elem.checked).length > 0;
        if (!doctorComplete) {
            const choiceRequired = document.querySelector("#doctor-question div.required");
            choiceRequired.style = "display: block";
            event.preventDefault();
        }

        const drugsComplete = Array.from(drugInputs).filter(elem => elem.checked).length > 0;
        if (!drugsComplete) {
            const choiceRequired = document.querySelector("#drugs-question div.required");
            choiceRequired.style = "display: block";
            event.preventDefault();
        }
    });

};


if (window.location.href.includes(Demographics.taskName)) {
    jsPsych.init({
        timeline: (new Demographics()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); }
    });
}
