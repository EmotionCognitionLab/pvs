import "./style.css";

import { getAuth } from "auth/auth.js";
import Db from "db/db.js";

const experimentSelect = document.getElementById("experiment-select");
const experimentButton = document.getElementById("experiment-button");
const experimentDownload = document.getElementById("experiment-download");

function initializeButton(db) {
    experimentButton.addEventListener("click", async () => {
        prepareDownload();
        const results = await db.getResultsForExperiment(experimentSelect.value);
        const filename = `${experimentSelect[experimentSelect.selectedIndex].label}.json`;
        enableDownload(results, filename);
    });
    experimentButton.removeAttribute("disabled");
}

function disableDownload() {
    experimentDownload.href = "";
    experimentDownload.download = "";
    experimentDownload.textContent = "...";
    experimentDownload.setAttribute("aria-disabled", "true");
}

function prepareDownload() {
    disableDownload();
    experimentDownload.textContent = "Querying...";
}

function enableDownload(results, filename) {
    experimentDownload.href = URL.createObjectURL(new Blob(
        [JSON.stringify(results)],
        {type: "application/json"}
    ));
    experimentDownload.download = filename;
    experimentDownload.textContent = "Download";
    experimentDownload.removeAttribute("aria-disabled");
}


disableDownload();
const auth = getAuth(
    session => {
        initializeButton(new Db({session: session}));
    },
    err => {
        console.debug("error:", err);
    }
);
auth.getSession();
