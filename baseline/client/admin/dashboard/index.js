import "./style.css";
import { Dashboard } from "./dashboard.js";
import { getAuth } from "auth/auth.js";
import ApiClient from "../../../../common/api/client.js";
import Db from "../../../../common/db/db.js";

getAuth(
    async session => {
        const db = new Db();
        db.session = session;
        const dashboard = new Dashboard(
            document.querySelector("#dashboard > tbody"),
            new ApiClient(session),
            db
        );
        await dashboard.refreshRecords();
        dashboard.showActive();
    },
    err => {
        console.error("error:", err);
    },
).getSession();
