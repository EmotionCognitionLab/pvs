import { getAuth } from "auth/auth.js";
import Db from "db/db.js";

const experimentSelect = document.getElementById("experiment-select");
const experimentButton = document.getElementById("experiment-button");

const auth = getAuth(
    session => {
        const db = new Db({session: session});
        ["flanker", "n-back", "spatial-orientation"].forEach(n => {
            const option = document.createElement("option");
            option.value = n;
            option.text = n;
            experimentSelect.add(option);
        });
        experimentSelect.removeAttribute("disabled");
        experimentButton.addEventListener("click", async () => {
            const experimentName = experimentSelect.value;
            const results = await db.getResultsForExperiment(experimentName);
            console.debug(results);
        });
        experimentButton.removeAttribute("disabled");
    },
    err => {
        console.debug("error:", err);
    }
);
auth.getSession();
