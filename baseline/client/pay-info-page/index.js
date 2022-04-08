import "./style.css";
import "../../../common/pay-info/style.css";
import { Payboard } from "pay-info";
import { getAuth, getIdToken, hasPreferredRole } from "auth/auth";
import ApiClient from "api/client";

const payboardDiv = document.getElementById("payboard");
const errorDiv = document.getElementById("error");

const TARGET_ID_KEY = "u";  // key name for target ID search parameter
function parseTargetId(searchQueryString) {
    return (new URLSearchParams(searchQueryString)).get(TARGET_ID_KEY);
}

function handleError(err) {
    console.error("error:", err);
    errorDiv.textContent = `error: ${err.message}`;
}

getAuth(
    session => {
        try {
            const idToken = getIdToken(session);
            const targetId = parseTargetId(window.location.search) ?? idToken.sub;
            const client = new ApiClient(session);
            const payboard = new Payboard(
                payboardDiv,
                errorDiv,
                new ApiClient(session),
                targetId,
                hasPreferredRole(idToken, "pvs-dev-study-admin"),
            );
            payboard.refresh();
        } catch (err) {
            handleError(err);
        }
    },
    handleError,
).getSession();
