import "./style.css";
import ApiClient from "../../../common/api/client";

async function init() {
    hideError();
    const queryParams = new URLSearchParams(window.location.search.substring(1));
    const envelopeId = queryParams.get("envelopeId");
    if (!envelopeId || envelopeId.trim() === "") {
        showError("Consent id not found.");
        return;
    }

    const fakeSession = {
        getIdToken: () => ({
            getJwtToken: () => ""
        })
    };
    const client = new ApiClient(fakeSession);
    const signingInfo = await client.getDsSigningInfo(envelopeId);
    if (signingInfo.length == 0) {
        showError(`No consent information found for id ${envelopeId}.`);
        return;
    }

    if (signingInfo.length > 1) {
        showError(`Expected to find one consent record for id ${envelopeId}, but found ${signingInfo.length}.`);
        return;
    }

    document.getElementById("submit-button").addEventListener('click', async (event) => {
        event.preventDefault();
        await registerUser(client, envelopeId);
    });

    const name = signingInfo[0].name;
    setName(name);
    const email = signingInfo[0].email;
    setEmail(email);
    setEnvelopeId(envelopeId);
    showRegForm();
}

function registrationFormIsValid() {
    let isValid = true;

    const phone = document.getElementById("phone");
    const phoneErr = document.querySelector("#phone + span.error");
    if (phone.validity.valid) {
        phoneErr.textContent = "";
        phoneErr.className = "error hidden";
    } else {
        if (phone.validity.patternMismatch) {
            phoneErr.textContent = "Phone numbers may only contain numbers, - and ( ).";
        }
        const trimmedPhone = phone.value.replaceAll(/[^0-9]+/g, "");
        if (trimmedPhone.length == 0) {
            phoneErr.textContent = "You must enter a phone number.";
        } else if (trimmedPhone.length < 10 || trimmedPhone.length > 11 || (trimmedPhone.length == 11 && trimmedPhone[0] != '1')) {
            phoneErr.textContent = "Please enter your phone number with area code";
        }
        phoneErr.className = "error";
        isValid = false;
    }

    const password = document.getElementById("password");
    const passErr = document.querySelector("#password + span.error");
    if (password.validity.valid) {
        passErr.textContent = "";
        passErr.className = "error hidden";
    } else {
        if (password.validity.valueMissing)  {
            passErr.textContent = "You must enter a password.";
        } else if (password.validity.tooShort) {
            passErr.textContent = "Passwords must be at least 12 characters long.";
        }
        passErr.className = "error";
        isValid = false;
    }

    const phoneConsent = document.getElementById("phoneConsent");
    const phoneConsentErr = document.querySelector("#phoneConsent ~ span.error");
    if (phoneConsent.validity.valid) {
        phoneConsentErr.textContent = "";
        phoneConsentErr.className = "error hidden";
    } else {
        phoneConsentErr.textContent = "You must select this if you wish to continue.";
        phoneConsentErr.className = "error";
        isValid = false;
    }

    return isValid;
}

async function registerUser(client, envelopeId) {
    if (!registrationFormIsValid()) {
        return;
    }

    let phone = document.getElementById("phone").value;
    // phone format is +12135551212
    if (!phone.startsWith("1")) {
        phone = "1" + phone;
    }
    phone = "+" + phone;

    const password = document.getElementById("password").value;
    try {
        await client.registerUser(envelopeId, phone, password);
        showEmailVerificationForm();
    } catch (err) {
        showError(err.message);
    }
}

function showRegForm() {
    document.getElementById("loading").classList.add("hidden");
    document.getElementById("registration-form").classList.remove("hidden");
}

function showEmailVerificationForm() {
    document.getElementById("registration-form").classList.add("hidden");
    document.getElementById("email-verification-form").classList.remove("hidden");
}
 
function showError(errMsg) {
    const errDiv = document.getElementById("errors");
    errDiv.innerHTML = `Something has gone wrong. Please contact the study administrator at uscheartbeam@gmail.com 
    and give them your name, email address, and the following error message: ${errMsg}`;
    errDiv.classList.remove("hidden");
}

function hideError() {
    const errDiv = document.getElementById("errors");
    errDiv.classList.add("hidden");
}

function setEmail(email) {
    document.querySelector('input[name="email"]').value = email;
}

function setName(name) {
    document.querySelector('input[name="name"]').value = name;
}

function setEnvelopeId(envelopeId) {
    document.querySelector('input[name="envelopeId"]').value = envelopeId;
}

(async() => {
    init();
})();
