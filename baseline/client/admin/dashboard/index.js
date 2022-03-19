import "./style.css";
import { Dashboard } from "./dashboard.js";
import { getAuth } from "auth/auth.js";
import ApiClient from "api/client";

getAuth(
    async session => {
        const dashboard = new Dashboard(
            document.querySelector("#dashboard > tbody"),
            new ApiClient(session)
        );
        await dashboard.refreshRecords();
        dashboard.showActive();
    },
    err => {
        console.error("error:", err);
    },
).getSession();
