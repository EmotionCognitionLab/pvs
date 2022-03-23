import "./style.css";
import { getIdToken, isAdmin, Payboard } from "node_modules/pay-info";
import { getAuth } from "auth/auth";
import ApiClient from "api/client";

const payboardDiv = document.getElementById("payboard");
const errorDiv = document.getElementById("error");

const TARGET_ID_KEY = "u";  // key name for target ID search parameter
function parseTargetId(searchQueryString) {
    return (new URLSearchParams(searchQueryString)).get(TARGET_ID_KEY);
}

function handleError(err) {
    console.error("error:", err);
    errorDiv.textContent = new String(err);
}

getAuth(
    async session => {
        try {
            const idToken = getIdToken(session);
            const targetId = parseTargetId(window.location.search) ?? idToken.sub;
            const client = new ApiClient(session);
            window.stuff = {targetId, idToken};
            // determine what kind of access (admin/self/invalid)
            if (isAdmin(idToken)) {
                const payboard = new Payboard(payboardDiv, new ApiClient(session), true);
                await payboard.refresh();
                payboard.show();
            } else if (targetId = idToken.sub) {
                const payboard = new Payboard(payboardDiv, new ApiClient(session), false);
                await payboard.refresh();
                payboard.show();
            } else {
                throw new Error("can't access user");
            }
        } catch (err) {
            handleError(err);
        }
    },
    handleError,
).getSession();
