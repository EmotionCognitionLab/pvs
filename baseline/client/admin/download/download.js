import "./style.css";

import { getAuth } from "auth/auth.js";
import ApiClient from "../../../../common/api/client.js";

const errorDiv = document.getElementById("error");
const experimentSelect = document.getElementById("experiment-select");
const experimentButton = document.getElementById("experiment-button");
const downloadStatus = document.getElementById("download-status");

function handleError(err) {
    errorDiv.textContent = `error: ${err.message ?? err}`;
    console.error("error:", err);
}

function initializeButton(apiClient) {
    experimentButton.addEventListener("click", async () => {
        startDownload();
        try {
            const results = await apiClient.getResultsForExperiment(experimentSelect.value);
            if (results.url) {
                window.location.href = results.url;
            } else if (results.empty) {
                alert(`There were no results for the "${experimentSelect.value}" experiment.`);
            }
        } catch (err) {
            handleError(err);
        }
        endDownload();
    });
}

function endDownload() {
    experimentButton.removeAttribute("disabled");
    downloadStatus.textContent = "";
}

function startDownload() {
    experimentButton.setAttribute("disabled", true);
    downloadStatus.textContent = "Querying...";
}

const auth = getAuth(
    session => {
        initializeButton(new ApiClient(session));
    },
    handleError,
);
auth.getSession();
