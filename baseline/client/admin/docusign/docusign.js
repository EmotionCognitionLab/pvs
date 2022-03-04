import { getAuth } from "auth/auth.js";
import ApiClient from "../../api/client";

class Consent {
    constructor(session) {
        this.client = new ApiClient(session);
    }

    handleFormSubmission(event) {
        event.preventDefault();
        console.debug(Consent.getInputValue(Consent.nameId));
        console.debug(Consent.getInputValue(Consent.emailId));
    }
}

Consent.getInputValue = (elemId) => {
    return document.getElementById(elemId).value;
};

Consent.submitBtnId = "submit-btn";
Consent.nameId = "participant-name";
Consent.emailId = "participant-email";

document.addEventListener("DOMContentLoaded", () => {
    getAuth(async session => {
        const consent = new Consent(session);
        const submitBtn = document.getElementById(Consent.submitBtnId);
            submitBtn.addEventListener("click", consent.handleFormSubmission);
        },
        err => console.error(err)
    ).getSession();
});

