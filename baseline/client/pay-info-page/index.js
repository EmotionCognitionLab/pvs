import "./style.css";
import "../../../common/pay-info/style.css";
import { Payboard } from "pay-info";
import ApiClient from "api/client";
import { getAuth, getIdToken, hasPreferredRole } from "auth/auth";
import awsSettings from '../../../common/aws-settings.json';

const payboardDiv = document.getElementById("payboard");
const errorDiv = document.getElementById("error");

const TARGET_ID_KEY = "u";  // key name for target ID search parameter
function parseTargetId(searchQueryString) {
    return (new URLSearchParams(searchQueryString)).get(TARGET_ID_KEY);
}

function handleError(err) {
    console.error("error:", err);
    errorDiv.textContent = `error: ${err.message ?? err}`;
}

getAuth(
    async session => {
        try {
            const idToken = getIdToken(session);
            const targetId = parseTargetId(window.location.search) ?? idToken.sub;
            const client = new ApiClient(session);
            const payboard = new Payboard(
                payboardDiv,
                errorDiv,
                client,
                targetId,
                hasPreferredRole(idToken, awsSettings.AdminRole),
            );
            await payboard.init();
        } catch (err) {
            handleError(err);
        }
    },
    handleError,
).getSession();
