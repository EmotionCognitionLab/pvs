import { getAuth } from "auth/auth.js";
import Db from "db/db.js";

const experimentSelect = document.getElementById("experiment-select");
const experimentButton = document.getElementById("experiment-button");
const experimentDownload = document.getElementById("experiment-download");

function initializeSelect() {
    ["flanker", "n-back", "spatial-orientation"].forEach(n => {
        const option = document.createElement("option");
        option.value = n;
        option.text = n;
        experimentSelect.add(option);
    });
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
