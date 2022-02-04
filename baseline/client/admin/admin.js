import "./style.css";

import { getAuth } from "auth/auth.js";
import Db from "db/db.js";

const experimentSelect = document.getElementById("experiment-select");
const experimentButton = document.getElementById("experiment-button");
const experimentDownload = document.getElementById("experiment-download");

const experimentNames = ["daily-stressors", "dass", "demographics", "face-name", "ffmq", "flanker", "mind-in-eyes", "mood-memory", "mood-prediction", "n-back", "panas", "pattern-separation-learning", "pattern-separation-recall", "physical-activity", "spatial-orientation", "task-switching", "verbal-fluency", "verbal-learning-learning", "verbal-learning-recall"];
function initializeSelect() {
    experimentNames.forEach(n => {
        const option = document.createElement("option");
        option.value = n;
        option.label = n;
        experimentSelect.add(option);
    });
    experimentSelect.removeAttribute("disabled");
}

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


initializeSelect();
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
