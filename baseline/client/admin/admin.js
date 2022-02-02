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
        option.text = n;
        experimentSelect.add(option);
    });
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.text = "all";
    experimentSelect.add(allOption);
    experimentSelect.removeAttribute("disabled");
}

function initializeButton(db) {
    experimentButton.addEventListener("click", async () => {
        prepareDownload();
        const results = await db.getResultsForExperiment(experimentSelect.value);
        enableDownload(results);
    });
    experimentButton.removeAttribute("disabled");
}

function disableDownload() {
    experimentDownload.href = "";
    experimentDownload.textContent = "...";
    experimentDownload.classList.remove("enabled");
}

function prepareDownload() {
    disableDownload();
    experimentDownload.textContent = "Querying...";
}

function enableDownload(results) {
    experimentDownload.href = URL.createObjectURL(new Blob(
        [JSON.stringify(results)],
        {type: "application/json"}
    ));
    experimentDownload.textContent = "Download";
    experimentDownload.classList.add("enabled");
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
