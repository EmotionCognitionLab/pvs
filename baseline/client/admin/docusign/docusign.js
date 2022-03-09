import { getAuth } from "auth/auth.js";
import ApiClient from "../../api/client";
import awsSettings from '../../../../common/aws-settings.json';

class Consent {
    constructor(session) {
        this.client = new ApiClient(session);
        this.client.getSelf().then(user => {
            if (!user.dsAuthed) {
                // do the OAuth dance to get the Docusign info
                const oauthUri = Consent.getOAuthUrl(["extended", "signature"]);
                window.location.href = oauthUri;
            }
        });
    }

    handleFormSubmission(event) {
        event.preventDefault();
        console.debug(Consent.getInputValue(Consent.nameId));
        console.debug(Consent.getInputValue(Consent.emailId));
    }
}

Consent.getOAuthUrl = (scopes) => {
    const dsClientId = awsSettings.DsId;
    const dsRedirectUri = encodeURIComponent(awsSettings.DsRedirectUri);
    const dsOAuthUri = awsSettings.DsOAuthUri;
    return `${dsOAuthUri}?response_type=code&scope=${scopes.join('+')}&client_id=${dsClientId}&redirect_uri=${dsRedirectUri}`;
};

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

