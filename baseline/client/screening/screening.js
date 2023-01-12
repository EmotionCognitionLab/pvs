import "@adp-psych/jspsych/jspsych.js";
import "@adp-psych/jspsych/plugins/jspsych-survey-html-form";
import "@adp-psych/jspsych/plugins/jspsych-survey-multi-choice";
import "@adp-psych/jspsych/plugins/jspsych-html-keyboard-response.js";
import "@adp-psych/jspsych/css/jspsych.css";
import "css/jspsych-survey-multi-choice-patch.css";
import "css/common.css";
import { Logger } from "logger/logger.js";
import awsSettings from "../../../common/aws-settings.json";

export class Screening {

    constructor() {
        this.logger = new Logger();
    }

    getTimeline() {      
        const isEligibleFn = this.isEligible.bind(this);
        const saveNotEligibleFn = this.saveNotEligibile.bind(this);
        const savePotentialParticipantFn = this.savePotentialParticipant.bind(this);

        return [
            {
                type: "survey-html-form",
                preamble: this.constructor.preamble,
                html: this.constructor.persInfo,
                on_finish: function(data) {
                    data.gender = data.response.gender;
                }
            },
            {
                type: "survey-multi-choice",
                preamble: 'Thanks! Please answer the below questions.',
                questions: function() {
                    const data = jsPsych.data.get().values()[0];
                    const questions = Screening.baseQuestions.map(Screening.yesNoDefaults);
                    if (data.gender === "male") {
                        return questions.filter(q => q.name !== Screening.pregName);
                    }
                    return questions;
                },
                on_finish: async function() {
                    const data = jsPsych.data.get().values();
                    if (!isEligibleFn(data)) {
                        jsPsych.endExperiment(Screening.notEligibleMsg);
                        await saveNotEligibleFn();
                    }
                }
            },
            {
                type: "survey-multi-choice",
                preamble: `
                <p>
                The training used in this study is known to be safe but may not be appropriate for people who have certain conditions. Therefore, we would like to make sure that you haven't experienced and are not currently experiencing any of the following conditions:
                </p>
                Have you ever had any of the following?
                `,
                questions: Screening.healthQuestions.map(Screening.yesNoDefaults),
                on_finish: async function() {
                    const data = jsPsych.data.get().values();
                    if (!isEligibleFn(data)) {
                        jsPsych.endExperiment(Screening.notEligibleMsg);
                        await saveNotEligibleFn();
                    }
                }
            },
            {
                type: "survey-multi-choice",
                preamble: `
                <p>
                In addition, we would like to make sure that you are safe to undergo an MRI scan. The MRI room contains a very strong magnet. Some metal objects can interfere with your scan or even be dangerous. The researchers must know if you have any metal in your body or if you have any of the following conditions:
                </p>
                `,
                questions: Screening.mriQuestions.map(Screening.yesNoDefaults),
                on_finish: async function() {
                    const data = jsPsych.data.get().values();
                    if (!isEligibleFn(data)) {
                        jsPsych.endExperiment(Screening.notEligibleMsg);
                        await saveNotEligibleFn();
                    }
                }
            },
            {
                type: "html-keyboard-response",
                stimulus: "Thank you for taking the time to complete this screening survey. Based on your responses, you are eligible to participate in the study. Our team will contact you soon regarding next steps.",
                choices: [],
                on_start: async function() {
                    const data = jsPsych.data.get().values();
                    await savePotentialParticipantFn(data);
                }
            }
        ];
    }

    isEligible(data) {
        const eligibilityMap = [
            ...this.constructor.baseQuestions,
            ...this.constructor.healthQuestions,
            ...this.constructor.mriQuestions
        ].reduce((prev, cur) => {
            prev[cur.name] = cur.ok;
            return prev;
        }, {});

        const responses = data.slice(1).map(d => d.response);
        let eligible = true;
        responses.forEach(r => Object.entries(r).forEach(e => {
            const quest = e[0];
            const ans = e[1].toLowerCase();
            if (eligibilityMap[quest] !== ans) {
                eligible = false;
            }
        }));

        return eligible;
    }

    async saveNotEligibile() {
        try {
            await fetch(awsSettings.ScreeningApiUrl, {
                method: "post",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-type": "application/json",
                },
                body: '{"status": "ineligible"}'
            });
        } catch (err) {
            // just log it; we don't need to
            // let them know or to do anything
            this.logger.error(err);
        }
    }

    async savePotentialParticipant(data) {
        try {
            const participantInfo = {
                status: "eligible",
                "first-name": data[0].response["first-name"],
                "last-name": data[0].response["last-name"],
                email: data[0].response.email,
                phone: data[0].response.phone,
                gender: data[0].response.gender,
                date: (new Date()).toLocaleString('en-US', {year: 'numeric', month: 'numeric', day: 'numeric'})
            };

            await fetch(awsSettings.ScreeningApiUrl, {
                method: "post",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-type": "application/json",
                },
                body: JSON.stringify(participantInfo)
            });

            // TODO check response for errors, ask them to fix
            // which means somehow displaying screen 1 again
            // and overwriting the old screen 1 data with the new

        } catch (err) {
            // TODO somehow display a retry button and ask them to click it?
            this.logger.error(err);
        }
    }
}

Screening.taskName = "screening";

Screening.notEligibleMsg = 'Thank you for taking the time to complete this screening survey. Unfortunately, you are not eligible to participate in this study. If you are not already a USC Healthy Minds volunteer and would like to learn about other opportunities to participate in USC studies, please visit <a href="http://healthyminds.usc.edu">healthyminds.usc.edu</a>.';

Screening.preamble = `
<p>
Thank you for your interest in the USC HeartBEAM study!
</p>
<p>
The purpose of this screening is to determine if you are eligible to participate in the study. Please note that the responses you provide will not be tied to your personal information in any way. Screening data will be used to determine eligibility then destroyed. For eligible participants, the study team will retain contact information (i.e. email and phone); for ineligible participants, the reason for ineligibility (i.e. did not meet inclusion criteria, declined to participate, etc.) will be retained. If you have any questions about this study, please contact Mara Mather at mara.mather@usc.edu. If you have any questions about your rights as a research participant, please contact the University of Southern California Institutional Review Board at (323) 442-0114 or email irb@usc.edu.
</p>
<p>
This screening should take about 10 minutes to complete. If you have any questions, please contact us at uscheartbeam@gmail.com.
</p>
`;

Screening.persInfo = `
<div>
    <label for="first-name">First Name: </label>
    <input type="text" id="first-name" name="first-name" placeholder="First name" required="true">
    <br/>
    <label for="last-name">Last Name: </label>
    <input type="text" id="last-name" name="last-name" placeholder="Last name" required="true">

    <br/>
    <label for="email">Email: </label>
    <input type="email" id="email" name="email" placeholder="email@example.com" prequired="true">

    <br/>
    <label for="phone">Phone: </label>
    <input type="tel" id="phone" name="phone" placeholder="111-222-3333" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" required="true">

    <br/>
    <label for="gender">Gender: </label>
    <select id="gender" name="gender" required="true">
        <option name="choose" value="" disabled selected>Select one</option>
        <option name="female" value="female">Female</option>
        <option name="male" value="male">Male</option>
        <option name="other" value="other">Other</option>
    </select>

</div>
`;

Screening.pregName = "not-preg-menstruating";

Screening.yesNoDefaults = (question) => ({
    prompt: question.prompt,
    name: question.name,
    required: true,
    options: ["Yes", "No"],
    horizontal: false
});

Screening.baseQuestions = [
    {
        prompt: "Do you speak English fluently?",
        name: "fluent-english",
        ok: "yes",
    },
    {
        prompt: "Are you between the age of 50 and 70?",
        name: "age-50-70",
        ok: "yes",
    },
    {
        prompt: "Are you a healthy adult who weighs at least 110 pounds?",
        name: "healthy-adult-110",
        ok: "yes",
    },
    {
        prompt: "Are you non-pregnant and non-menstruating (for at least the past year)?",
        name: Screening.pregName,
        ok: "yes",
    },
    {
        prompt: "Do you have normal or corrected-to-normal vision and hearing?",
        name: "normal-vision-hearing",
        ok: "yes",
    },
    {
        prompt: "Do you have a home computer with a physical keyboard and have access to reliable internet?",
        name: "has-keyboard-internet",
        ok: "yes",
    },
    {
        prompt: "Do you have an email account that you check regularly?",
        name: "has-email",
        ok: "yes",
    },
    {
        prompt: "Do you have a phone that receives text messages?",
        name: "can-text",
        ok: "yes",
    },
    {
        prompt: "Would you be willing to provide a blood and urine sample at some lab visits?",
        name: "will-give-blood",
        ok: "yes",
    },
    {
        prompt: "Would you be willing to devote up to 60 minutes at home daily for the entire duration of the study as well as attend all campus visits?",
        name: "will-train",
        ok: "yes",
    },
    {
        prompt: "Do you regularly practice any relaxation, biofeedback, or breathing technique (e.g., meditation) for more than an hour a week?",
        name: "does-meditate",
        ok: "no",
    },
    {
        prompt: "Have you regularly played Lumosity games in the past 6 months?",
        name: "plays-lumosity",
        ok: "no",
    },
    {
        prompt: "Have you participated in heart rate biofeedback studies at the USC Emotion & Cognition Lab?",
        name: "did-hr-study",
        ok: "no",
    },
];

Screening.healthQuestions = [
    {
        prompt: "Abnormal cardiac rhythm",
        name: "abnorm-cardiac",
        ok: "no",
    },
    {
        prompt: "Heart disease (including coronary artery disease, angina, and arrhythmia)",
        name: "heart-disease",
        ok: "no",
    },
    {
        prompt: "Cognitive impairment",
        name: "cog-impair",
        ok: "no",
    },
    {
        prompt: "Dyspnea (difficult or labored breathing) ",
        name: "dyspnea",
        ok: "no",
    },
];

Screening.mriQuestions = [
    {
        prompt: "Claustrophobia",
        name: "claustrophobia",
        ok: "no",
    },
    {
        prompt: "Have worked as a machinist, metal worker, or in any profession or hobby grinding metal",
        name: "machinist",
        ok: "no"
    },
    {
        prompt: "Have had an injury to the eye involving a metallic object (e.g. metallic slivers, shavings, or foreign body)",
        name: "metal-eye",
        ok: "no"
    },
    {
        prompt: "Cardiac pacemaker",
        name: "pacemaker",
        ok: "no"
    },
    {
        prompt: "Implanted cardiac defibrillator",
        name: "defib",
        ok: "no"
    },
    {
        prompt: "Aneurysm clip or brain clip",
        name: "brain-clip",
        ok: "no"
    },
    {
        prompt: "Carotid artery vascular clamp",
        name: "carotid-clamp",
        ok: "no"
    },
    {
        prompt: "Neurostimulator",
        name: "neurostim",
        ok: "no"
    },
    {
        prompt: "Insulin or infusion pump",
        name: "insulin-pump",
        ok: "no"
    },
    {
        prompt: "Spinal fusion stimulator",
        name: "spinal-stim",
        ok: "no"
    },
    {
        prompt: "Cochlear, otologic, ear tubes or ear implant",
        name: "ear-implant",
        ok: "no"
    },
    {
        prompt: "Prosthesis (eye/orbital, penile, etc.) ",
        name: "prosthesis",
        ok: "no"
    },
    {
        prompt: "Implant held in place by a magnet",
        name: "magnet-implant",
        ok: "no"
    },
    {
        prompt: "Heart valve prosthesis",
        name: "heart-valve",
        ok: "no"
    },
    {
        prompt: "Artificial limb or joint",
        name: "fake-limb",
        ok: "no"
    },
    {
        prompt: "Other implants in body or head",
        name: "other-implants",
        ok: "no"
    },
    {
        prompt: "Electrodes (on body, head or brain)",
        name: "electrodes",
        ok: "no"
    },
    {
        prompt: "Intravascular stents, filters",
        name: "stents",
        ok: "no"
    },
    {
        prompt: "Shunt (spinal or intraventricular)",
        name: "shunt",
        ok: "no"
    },
    {
        prompt: "Vascular access port or catheters",
        name: "catheter",
        ok: "no"
    },
    {
        prompt: "IUD",
        name: "iud",
        ok: "no"
    },
    {
        prompt: "Transdermal delivery system or other types of foil patches (e.g. Nitro, Nicotine, Birth control, etc.) that cannot be removed for MRI",
        name: "transderm",
        ok: "no"
    },
    {
        prompt: "Shrapnel, buckshot, or bullets",
        name: "shrapnel",
        ok: "no"
    },
    {
        prompt: "Tattooed eyeliner or eyebrows",
        name: "tat-eye",
        ok: "no"
    },
    {
        prompt: "Body piercings that cannot be removed for MRI",
        name: "body-pierce",
        ok: "no"
    },
    {
        prompt: "Metal fragments (eye, head, ear, skin)",
        name: "metal-frag",
        ok: "no"
    },
    {
        prompt: "Internal pacing wires",
        name: "internal-wires",
        ok: "no"
    },
    {
        prompt: "Aortic clips",
        name: "aortic-clips",
        ok: "no"
    },
    {
        prompt: "Metal or wire mesh implants",
        name: "metal-implants",
        ok: "no"
    },
    {
        prompt: "Wire sutures or surgical staples",
        name: "staples",
        ok: "no"
    },
    {
        prompt: "Harrington rods (spine)",
        name: "spine-rod",
        ok: "no"
    },
    {
        prompt: "Bone/joint pin, screw, nail, wire, plate",
        name: "bone-screw",
        ok: "no"
    },
    {
        prompt: "Wig or toupee that cannot be removed for MRI",
        name: "wig",
        ok: "no"
    },
    {
        prompt: "Hair implants that involve staples or metal",
        name: "hair-implants",
        ok: "no"
    },
    {
        prompt: "Hearing aid(s) that cannot be removed for MRI",
        name: "hear-aid",
        ok: "no"
    },
    {
        prompt: "Dentures or retainers that cannot be removed for MRI",
        name: "dentures",
        ok: "no"
    },
];

if (window.location.href.includes(Screening.taskName)) {
    jsPsych.init({
        timeline: (new Screening()).getTimeline()
    });
}
