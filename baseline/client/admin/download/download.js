import "./style.css";

import { getAuth } from "auth/auth.js";
import ApiClient from "../../api/client";

const experimentSelect = document.getElementById("experiment-select");
const experimentButton = document.getElementById("experiment-button");
const experimentDownload = document.getElementById("experiment-download");

function initializeButton(apiClient) {
    experimentButton.addEventListener("click", async () => {
        startDownload();
        const results = await apiClient.getResultsForExperiment(experimentSelect.value);
        endDownload();
        if (results.url) {
            window.location.href = results.url;
        } else if (results.empty) {
            alert(`There were no results for the "${experimentSelect.value}" experiment.`);
        }
    });
}

function endDownload() {
    experimentButton.removeAttribute("disabled");
    experimentDownload.textContent = "";
}

function startDownload() {
    experimentButton.setAttribute("disabled", true);
    experimentDownload.textContent = "Querying...";
}

const auth = getAuth(
    session => {
        initializeButton(new ApiClient(session));
    },
    err => {
        console.error("error:", err);
    }
);
auth.getSession();
