import { getAuth, sendPhoneVerificationCode, verifyPhone } from "auth/auth.js";
import Db from "db/db.js";
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
    const db = new Db({session: cachedSession});
    db.updateSelf({"phone_number_verified": true});
}

function phoneVerificationFailure(err) {
    showError(err, 'There was a problem verifiying your phone. Please double-check that you entered the phone verification code correctly and try again.');
}

async function showPhoneConfirmForm() {
    const db = new Db({session: cachedSession});
    let oldPhoneNumber = '';
    try {
        oldPhoneNumber = (await db.getSelf()).phone_number;
    } catch (err) {
        showError(err, 'There was a problem retrieving your phone number. Please reenter your phone number.');
    }
    document.getElementById(phoneConfirmFieldId).value = oldPhoneNumber;
    document.getElementById(phoneConfirmFormId).classList.remove('hidden');
    document.getElementById(phoneConfirmSubmitId).addEventListener('click', async () => {
        const phoneNumber = document.getElementById(phoneConfirmFieldId).value;
        // validate phone number in field
        if (false) {  // to-do: validate phone number
            return;
        }
        document.getElementById(phoneConfirmFormId).classList.add('hidden');
        // update phone number associated with user if different
        if (phoneNumber != oldPhoneNumber) {
            try {
                await db.updateSelf({'phone_number': phoneNumber});
            } catch (err) {
                showError(err, 'There was a problem updating your phone number. Please try again.');
                showPhoneConfirmForm();
                return;
            }
        }
        // send code to newly confirmed phone number and show verification form
        sendPhoneCode(cachedSession);
        showPhoneVerificationForm();
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
    let cognitoAuth = getAuth(loginSuccess, 
        (err) => showError(err, 'There was an error logging you in.')
    );
    const curUrl = window.location.href;
    if (curUrl.indexOf('?') > -1) {
        cognitoAuth.parseCognitoWebResponse(curUrl);
    } else {
        cognitoAuth.getSession();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById(phoneVerificationSubmitButtonId).addEventListener('click', 
        () => { confirmPhoneVerificationCode(phoneVerificationSuccess, phoneVerificationFailure); }
    );
    handleLogin();
});
