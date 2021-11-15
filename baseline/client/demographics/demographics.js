import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-html-form";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/common.css";
import "./style.css";

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
    });

};

// We put this here rather than in a standalone file
// so that it is loaded for tests. If it's in a standalone
// file we just get "test.file.stub" instead of all this HTML.
Demographics.form = `
<div class="demo-question" id="race-question">
    <p>Please indicate your race:</p>
    <input type="radio" id="aa" name="race" value="african_american" required>
    <label for="aa">African American</label>
    <br/>

    <input type="radio" id="c" name="race" value="caucasian">
    <label for="c">Caucasian</label>
    <br/>

    <input type="radio" id="a" name="race" value="asian">
    <label for="a">Asian</label>
    <br/>
    
    <!-- Do not change without also changing related javascript -->
    <input type="radio" id="o" name="race" value="other">
    <label for="o">Other</label>
    <input type="text" id="o_text" name="race_other" disabled>
    <br/>

    <input type="radio" id="ai" name="race" value="american_indian_alaska_native">
    <label for="ai">American Indian/Alaska Native</label>
    <br/>
    
    <input type="radio" id="pi" name="race" value="pacific_islander_native_hawaiian">
    <label for="pi">Pacific Islander/Native Hawaiian</label>
    <br/>

    <!-- Do not change without also changing related javascript -->
    <input type="radio" id="bi" name="race" value="biracial">
    <label for="bi">Biracial</label>
    <input type="text" id="bi1_text" name="race_bi1" disabled> and <input type="text" id="bi2_text" name="race_bi2" disabled>
    <br/>

    <input type="radio" id="p" name="race" value="prefer_not_to_state">
    <label for="p">Prefer not to state</label>
    <br/>
</div>

<div class="demo-question">
    <p>Please indicate your ethnicity:</p>
    <input type="radio" id="ethH" name="ethnicity" value="hispanic" required>
    <label for="ethH">Hispanic</label>

    <input type="radio" id="ethNH" name="ethnicity" value="non_hispanic">
    <label for="ethNH">Non-Hispanic</label>

    <input type="radio" id="ethN" name="ethnicity" value="prefer_not_to_state">
    <label for="ethN">Prefer not to state</label>
</div>

<div class="demo-question">
    <p>How many years of education have you received, including grade school?</p>
    <input type="number" name="education_years" min="0" max="40" id="educationYears" size="3" required>
    <label for="educationYears">(for reference, 12 = HS diploma, 16 = Bachelor's degree)</label>
</div>

<div class="demo-question">
    <p>Are you retired?</p>
    <input type="radio" id="retiredY" name="retired" value="yes" required>
    <label for="retiredY">Yes</label>

    <input type="radio" id="retiredN" name="retired" value="no">
    <label for="retiredN">No</label>
</div>

<div class="demo-question">
    <p>What is your profession? If you are retired, what was your profession?</p>
    <input type="text" name="profession" id="profession" required>
</div>

<div class="demo-question" id="vax-question">
    <p>Have you been vaccinated against COVID-19?</p>
    <input type="radio" id="covidVaxY" name="covid_vax" value="yes" required>
    <label for="covidVaxY">Yes</label>

    <input type="radio" id="covidVaxN" name="covid_vax" value="no">
    <label for="covidVaxN">No</label>

    <div id="vax-followup">
        <label for="1stdose">1st dose</label>
        <input type="date" name="covid_vax_1st_dose" id="1stdose" min="2020-12-01">

        <label for="2nddose">2nd dose</label>
        <input type="date" name="covid_vax_2nd_dose" id="2nddose" min="2020-12-15">
    </div>
</div>

<div class="demo-question">
    <p>Please indicate all of the dates (if any) on which you have tested positive for COVID-19:</p>
    <input type="date" min="2019-01-01" name="covid_positive_test1">
    <input type="date" min="2019-01-01" name="covid_positive_test2">
    <input type="date" min="2019-01-01" name="covid_positive_test3">
</div>

<div class="demo-question" id="smoker-question">
    <p>Have you ever been a smoker?</p>
    <input type="radio" name="ever_smoked" id="everSmokedY" value="yes" required>
    <label for="everSmokedY">Yes</label>

    <input type="radio" name="ever_smoked" id="everSmokedN" value="no">
    <label for="everSmokedN">No</label>
</div>

<div class="demo-question">
    <p>How many alcoholic drinks do you drink per week?</p>
    <input type="number" min="0" max="99" name="weekly_alcoholic_drinks" id="weeklyAlcoholicDrinks" required>
</div>

<div class="demo-question" id="doctor-question">
    <p>Are you <em>currently</em> under a doctor’s care for any of the following?</p>
    <div class="required">Please choose at least one option below.</div>
    <input type="checkbox" name="heart_disease" id="heartDisease"/>
    <label for="heartDisease">Heart disease (including coronary artery disease, angina, and arrhythmia)</label>
    <br/><input type="checkbox" name="vascular_disease" id="vascularDisease"/>
    <label for="vascularDisease">Vascular disease</label>
    <br/><input type="checkbox" name="diabetes" id="diabetes"/>
    <label for="diabetes">Diabetes</label>
    <div id="diabetes-followup">
        <div class="required">Please indicate which type(s) of diabetes you have:</div>
        Type of diabetes:
        <input type="checkbox" name="diabetes_type_1" id="type1"/>
        <label for="diabetes_type_1">Type 1</label>
        <input type="checkbox" name="diabetes_type_2" id="type2"/>
        <label for="diabetes_type_2">Type 2</label>
        <input type="checkbox" name="diabetes_pre_diabetes" id="preDiabetes"/>
        <label for="diabetes_pre_diabetes">Pre-diabetes</label>
    </div>
    <br/><input type="checkbox" name="doctorNone" id="doctorNone"/>
    <label for="doctorNone">None of them</label>
</div>

<div class="demo-question" id="psych-question">
    <p>Have you ever been diagnosed with a psychiatric disorder?</p>
    <input type="radio" name="psych_diag" id="psychDiagY" value="yes" required>
    <label for="psychDiagY">Yes</label>

    <input type="radio" name="psych_diag" id="psychDiagN" value="no">
    <label for="psychDiagN">No</label>
    <div id="psych-followup">
        <label for="psychDiagWhich">Please specify:</label>
        <input type="text" name="psych_diag_which" id="psychDiagWhich">
    </div>
</div>

<div class="demo-question">
    <p>Have you ever been told by a doctor or other health professional that you had any of the following? <br/> Indicate if yes, otherwise leave blank.</p>
    <div id="diseases">
        <div class="col">
            <input type="checkbox" name="hypertension" id="hypertension">
            <label for="hypertension">Hypertension</label>
            <br/>
            <input type="checkbox" name="coronary_heart_disease" id="coronaryHeartDisease">
            <label for="coronaryHeartDisease">Coronary heart disease</label>
            <br/>
            <input type="checkbox" name="heart_attack" id="heartAttack">
            <label for="heartAttack">A heart attack (myocardial infarction)</label>
            <br/>
            <input type="checkbox" name="multiple_sclerosis" id="multipleSclerosis">
            <label for="multipleSclerosis">Multiple sclerosis</label>
            <br/>
            <input type="checkbox" name="parkinsons" id="parkinsons">
            <label for="parkinsons">Parkinson's disease</label>
            <br/>
            <input type="checkbox" name="neuropathy" id="neuropathy">
            <label for="neuropathy">Neuropathy</label>
            <br/>
            <input type="checkbox" name="seizures" id="seizures">
            <label for="seizures">Seizures</label>
            <br/>
            <input type="checkbox" name="heart_condition" id="heartCondition">
            <label for="heartCondition">Any kind of heart condition or heart disease</label>
            <br/>
            <input type="checkbox" name="stroke" id="stroke">
            <label for="stroke">Stroke</label>
            <br/>
            <input type="checkbox" name="arthritis_et_al" id="arthritisEtAl">
            <label for="arthritisEtAl">Arthritis, rheumatoid arthritis, gout, lupus or fibromyalgia</label>
            <br/>
            <input type="checkbox" name="emphysema" id="emphysema">
            <label for="emphysema">Emphysema</label>
            <br/>
            <input type="checkbox" name="cancer" id="cancer">
            <label for="cancer">Cancer or malignancy of any kind</label>
        </div>
        <div class="col">
            <input type="checkbox" name="poor_circulation" id="poorCirculation">
            <label for="poorCirculation">Poor circulation in your legs</label>
            <br/>
            <input type="checkbox" name="irregular_heartbeats" id="irregularHeartbeats">
            <label for="irregularHeartbeats">Irregular heartbeats</label>
            <br/>
            <input type="checkbox" name="congestive_heart" id="congestiveHeart">
            <label for="congestiveHeart">Congestive heart failure</label>
            <br/>
            <input type="checkbox" name="asthma" id="asthma">
            <label for="asthma">Asthma</label>
            <br/>
            <input type="checkbox" name="osteoporosis_tendonitis" id="osteoporosisTendonitis">
            <label for="osteoporosisTendonitis">Osteoporosis or tendonitis</label>
            <br/>
            <input type="checkbox" name="ulcers" id="ulcers">
            <label for="ulcers">Ulcers</label>
            <br/>
            <input type="checkbox" name="varicose_hemorrhoids" id="varicoseHemorrhoids">
            <label for="varicoseHemorrhoids">Varicose veins or hemorrhoids</label>
            <br/>
            <input type="checkbox" name="narcolepsy" id="narcolepsy">
            <label for="narcolepsy">Narcolepsy</label>
            <br/>
            <input type="checkbox" name="sleep_apnea" id="sleepApnea">
            <label for="sleepApnea">Sleep apnea or other sleep disorder</label>
            <br/>
            <input type="checkbox" name="other_disease" id="otherDisease">
            <label for="otherDisease">Other? Please specify: </label><input type="text" disabled name="other_disease_which" id="otherDiseaseWhich">
        </div>
    </div>
</div>

<div class="demo-question">
    <p>Are you currently taking any medications/drugs for any of the following?<br/>
        (Including over-the-counter drug, alternative remedies and prescription medication.)
    </p>
    <input type="checkbox" name="antidepressant_med" id="antidepressantMed">
    <label for="antidepressantMed">Antidepressant or anti-anxiety medication</label><br/>
    <input type="checkbox" name="blood_pressure_med" id="bloodPressureMed">
    <label for="bloodPressureMed">High blood pressure medication</label><br/>
    <input type="checkbox" name="thyroid_med" id="thyroidMed">
    <label for="thyroidMed">Thyroid medication</label><br/>
    <input type="checkbox" name="heart_disease_med" id="heartDiseaseMed">
    <label for="heartDiseaseMed">Heart disease related</label><br/>
    <input type="checkbox" name="pain_reliever_med" id="painRelieverMed">
    <label for="painRelieverMed">Pain relievers</label><br/>
    <input type="checkbox" name="sleep_aide_med" id="sleepAideMed">
    <label for="sleepAideMed">Sleep aides</label><br/>
    <input type="checkbox" name="inhaler_med" id="inhalerMed">
    <label for="inhalerMed">Inhaler</label><br/>
    <input type="checkbox" name="headache_reliever_med" id="headacheRelieverMed">
    <label for="headacheRelieverMed">Headache relievers</label>
</div>

<div class="demo-question">
    <p>Please list any medications/drugs you are currently taking and the dosage <br/>
        (amount and frequency)—including over-the-counter drugs, alternative remedies<br/> 
        and prescription medications, especially those that fit in the categories above.
    </p>
    <label for="med1Name">Name</label><input type="text" name="med1_name" id="med1Name">
    <label for="med1Dose">Dosage</label><input type="text" name="med1_dose" id="med1Dose"><br/>
    <label for="med2Name">Name</label><input type="text" name="med2_name" id="med2Name">
    <label for="med2Dose">Dosage</label><input type="text" name="med2_dose" id="med2Dose"><br/>
    <label for="med3Name">Name</label><input type="text" name="med3_name" id="med3Name">
    <label for="med3Dose">Dosage</label><input type="text" name="med3_dose" id="med3Dose"><br/>
    <label for="med4Name">Name</label><input type="text" name="med4_name" id="med4Name">
    <label for="med4Dose">Dosage</label><input type="text" name="med4_dose" id="med4Dose"><br/>
    <label for="med5Name">Name</label><input type="text" name="med5_name" id="med5Name">
    <label for="med5Dose">Dosage</label><input type="text" name="med5_dose" id="med5Dose"><br/>
    <label for="med6Name">Name</label><input type="text" name="med6_name" id="med6Name">
    <label for="med6Dose">Dosage</label><input type="text" name="med6_dose" id="med6Dose"><br/>
</div>
<hr/>
<h3>Women Only</h3>

<div class="demo-question">
    <p>When was the last time you had your menstrual period?<br/>
    </p>
    <select name="last_menstrual_period" id="lastMenstrualPeriod">
        <option value="1-2y"/>1-2 years</option>
        <option value="3-6y"/>3-6 years</option>
        <option value="7-10y"/>7-10 years</option>
        <option value="10+y"/>&gt;10 years</option>
    </select>
</div>

<div class="demo-question" id="estrogen-question">
    <p>Have you ever taken an estrogen replacement medication?</p>
    <input type="radio" name="estrogen_replacement_med" id="estrogenReplacementMedY">
    <label for="estrogenReplacementMedY">Yes</label>
    <input type="radio" name="estrogen_replacement_med" id="estrogenReplacementMedN">
    <label for="estrogenReplacementMedN">No</label>
    <div id="estrogen-followup">
        <p>Do you currently take this medication?</p>
        <input type="radio" name="estrogen_replacement_current" id="estrogenReplacementCurrentY">
        <label for="estrogenReplacementCurrentY">Yes</label>
        <input type="radio" name="estrogen_replacement_current" id="estrogenReplacementCurrentN">
        <label for="estrogenReplacementCurrentN">No</label>
    </div>
</div>
`;

if (window.location.href.includes(Demographics.taskName)) {
    jsPsych.init({
        timeline: (new Demographics()).getTimeline(),
        on_finish: () => { jsPsych.data.displayData("json"); }
    });
}
