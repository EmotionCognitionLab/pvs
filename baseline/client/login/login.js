import { getAuth, sendPhoneVerificationCode, updateUserAttributes, verifyPhone } from "auth/auth.js";
import Db from "db/db.js";
import { validPhoneNumber } from "js/validate.js";
import './style.css';

const phoneVerificationFormId = 'phoneVerification';
const errorMessageId = 'errorMessage';
const phoneVerificationSubmitButtonId = 'submitPhoneVerification';
const phoneVerificationSuccessId = 'phoneVerificationSuccess';
const phoneCodeSendFailedId = 'phoneCodeSendFailed';
const resendPhoneCodeNormalId = 'resendPhoneCodeNormal';
const resendPhoneCodeErrorId = 'resendPhoneCodeError';
const phoneConfirmFormId = 'phoneConfirm';
const phoneConfirmFieldId = 'phoneConfirmField';
const phoneConfirmSubmitId = 'phoneConfirmSubmit';
const phoneConfirmMsgId = 'phoneConfirmMsg';
const skipPhoneVerificationId = 'skipPhoneVerification';
let allowSkip = false;

let cachedSession = null;

function loginSuccess(session) {
    cachedSession = session;
    const idToken = session.getIdToken().getJwtToken();
    if (idToken) {
        const payload = idToken.split('.')[1];
        const tokenobj = JSON.parse(atob(payload));
        const phoneNumberVerified = tokenobj.phone_number_verified;
        if (!phoneNumberVerified) {
            sendPhoneCode(session);    
        } else {
            goToDailyTasks();
        }
    } else {
        showError(null, "There was a problem logging you in. Please try again.");
    }
}

function sendPhoneCode(session) {
    // in case we're resending, hide the error message
    const errMsgDiv = document.getElementById(phoneCodeSendFailedId);
    if (errMsgDiv) {
        errMsgDiv.classList.add('hidden');
    }
    const accessToken = session.getAccessToken().getJwtToken();
    sendPhoneVerificationCode(accessToken, showPhoneVerificationForm, sendingPhoneVerificationCodeFailed);
}

function confirmPhoneVerificationCode(successCallback, failureCallback) {
    const code = document.getElementById('phoneVerificationCode').value;
    verifyPhone(cachedSession.getAccessToken().getJwtToken(), code, successCallback, failureCallback);
}

function showPhoneVerificationForm() {
    document.getElementById(phoneVerificationFormId).classList.remove('hidden');
    if (allowSkip) {
        document.getElementById(skipPhoneVerificationId).classList.remove('hidden');
    } else {
        document.getElementById(skipPhoneVerificationId).classList.add('hidden');
    }
    document.getElementById(resendPhoneCodeNormalId).addEventListener('click', () => {
        document.getElementById(phoneVerificationFormId).classList.add('hidden');
        showPhoneConfirmForm();
    });
}

function sendingPhoneVerificationCodeFailed(err) {
    console.error(err); // TODO remote logging
    document.getElementById(phoneCodeSendFailedId).classList.remove('hidden');
    document.getElementById(resendPhoneCodeErrorId).addEventListener('click',
        () => { sendPhoneCode(cachedSession); }
    );
}

function phoneVerificationSuccess() {
    // in case they made a mistake on the first try, hide
    // any error message we might be showing
    const errDiv = document.getElementById(errorMessageId);
    if (errDiv) {
        errDiv.classList.add('hidden');
    }
    document.getElementById(phoneVerificationFormId).classList.add('hidden');
    document.getElementById(phoneVerificationSuccessId).classList.remove('hidden');
    document.getElementById('continueButton').addEventListener('click', goToDailyTasks);
    try {
        const db = new Db({session: cachedSession});
        db.updateSelf({"phone_number_verified": true});
    } catch (err) {
        const idToken = cachedSession.getIdToken().getJwtToken();
        let sub = 'unknown';
        if (idToken) {
            const payload = idToken.split('.')[1];
            const tokenobj = JSON.parse(atob(payload));
            sub = tokenobj.sub;
        }
        console.log(`Error setting phone_number_verified to true in dynamo for sub ${sub}`);
        console.log(err);
    }
    
}

function phoneVerificationFailure(err) {
    showError(err, 'There was a problem verifiying your phone. Please double-check that you entered the phone verification code correctly and try again.');
}

async function showPhoneConfirmForm() {
    document.getElementById(phoneConfirmMsgId).classList.remove('hidden');
    const db = new Db({session: cachedSession});
    let oldPhoneNumber = '';
    try {
        oldPhoneNumber = (await db.getSelf()).phone_number;
    } catch (err) {
        document.getElementById(phoneConfirmMsgId).classList.add('hidden');
        document.getElementById(phoneConfirmFieldId).setAttribute('placeholder', '+12125551234');
        showError(err, 'There was a problem retrieving your phone number. Please reenter your phone number.');
    }
    document.getElementById(phoneConfirmFieldId).value = oldPhoneNumber;
    document.getElementById(phoneConfirmFormId).classList.remove('hidden');
    document.getElementById(phoneConfirmSubmitId).addEventListener('click', async () => {
        const phoneNumber = document.getElementById(phoneConfirmFieldId).value;
        // validate phone number in field
        if (!validPhoneNumber(phoneNumber)) {
            showError(null, 'Invalid phone number format. Please start your phone number with +1 and include only digit characters afterwards. Example: +11235550100.');
            return;
        }
        // hide phone confirm form and any error
        document.getElementById(phoneConfirmFormId).classList.add('hidden');
        document.getElementById(errorMessageId).classList.add('hidden');
        // update phone number associated with user if different
        if (phoneNumber != oldPhoneNumber) {
            try {
                const accessToken = cachedSession.getAccessToken().getJwtToken();
                updateUserAttributes(accessToken, [{Name: 'phone_number', Value: phoneNumber}], 
                    async () => await db.updateSelf({'phone_number': phoneNumber}),
                    (err) => showError(err, 'There was a problem updating your phone number. Please try again.')
                );
            } catch (err) {
                showError(err, 'There was a problem updating your phone number. Please try again.');
                showPhoneConfirmForm();
                return;
            }
        }
        // send code to newly confirmed phone number and show verification form
        allowSkip = true;
        sendPhoneCode(cachedSession);
    });
}

function goToDailyTasks() {
    window.location.href = '/daily-tasks/';
}

function showError(err, msg) {
    if (err) console.error(err); // TODO remote logging
    const errDiv = document.getElementById(errorMessageId);
    errDiv.innerHTML = msg;
    errDiv.classList.remove('hidden');
}

function handleLogin() {
    console.debug('in handleLogin');
    const scopes = ['openid'];
    const queryParams = new URLSearchParams(window.location.search.substring(1));
    const needsValidation = queryParams.get("needsValidation");
    if (needsValidation === "1") scopes.push('aws.cognito.signin.user.admin');
    let cognitoAuth = getAuth(loginSuccess, 
        (err) => showError(err, 'There was an error logging you in.'),
        null,
        scopes
    );
    const curUrl = window.location.href;
    console.debug("curUrl.indexOf('?') > -1", curUrl.indexOf('?') > -1);
    if (queryParams.get("code")) {
        console.debug("going to call parseCognitoWebResponse");
        cognitoAuth.parseCognitoWebResponse(curUrl);
    } else {
        console.debug("going to call getSession");
        cognitoAuth.getSession();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById(phoneVerificationSubmitButtonId).addEventListener('click', 
        () => { confirmPhoneVerificationCode(phoneVerificationSuccess, phoneVerificationFailure); }
    );
    document.getElementById(skipPhoneVerificationId).addEventListener('click', goToDailyTasks);
    console.debug('in DOMContentLoaded event, about to call handleLogin');
    handleLogin();
});
