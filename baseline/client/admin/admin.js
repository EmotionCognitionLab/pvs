import { getAuth } from "auth/auth.js";
import Db from "db/db.js";

const auth = getAuth(
    async session => {
        const db = new Db({session: session});
        const results = await db.getResultsForExperiment("spatial-orientation");
        console.debug(results);
    },
    err => {
        console.debug("error:", err);
    }
);
auth.getSession();
