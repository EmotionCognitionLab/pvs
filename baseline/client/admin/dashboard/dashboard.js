import "./style.css";

import { getAuth } from "auth/auth.js";
import ApiClient from "../../api/client";
import Db from "db/db.js";

const dashboardBody = document.querySelector("#dashboard > tbody");

function clearDashboard() {
    while (dashboardBody.firstChild) {
        dashboardBody.firstChild.remove();
    }
}

function addDashboardRow(user, finishedSetsT1, finishedSetsT2) {
    // insert row element
    const row = dashboardBody.insertRow();
    // helper for cells that contain progress bars
    const createProgressDiv = (max, value, text) => {
        const progress = document.createElement("progress");
        progress.setAttribute("max", String(max));
        progress.setAttribute("value", String(value));
        const label = document.createElement("label");
        label.textContent = text;
        label.appendChild(progress);
        const span = document.createElement("span");
        span.textContent = `${Math.round(100*value/max)}%`;
        const div = document.createElement("div");
        div.appendChild(label);
        div.appendChild(span);
        return div;
    };
    // helper for cells that contain a markable date
    const createMarkableDiv = (key, timestamp = null) => {
        const button = document.createElement("button");
        const disableButton = () => {
            button.disabled = true;
            button.textContent = "Done.";
        };
        if (timestamp) {
            disableButton();
        } else {
            const callback = () => {
                button.removeEventListener("click", callback);
                disableButton();
            };
            button.addEventListener("click", callback);
            button.textContent = "Done?";
        }
        const span = document.createElement("span");
        span.textContent = timestamp ?? "null";
        const div = document.createElement("div");
        div.appendChild(button);
        div.appendChild(span);
        return div;
    };
    // add Subject ID cell
    row.insertCell().textContent = user.name;
    // Daily Tasks T1
    row.insertCell().appendChild(createProgressDiv(6, finishedSetsT1, `${finishedSetsT1}/6 sets completed`));
    // EEG T1
    row.insertCell().appendChild(createMarkableDiv(undefined, undefined));
    // MRI T1
    row.insertCell().appendChild(createMarkableDiv(undefined, undefined));
    // Biofeedback Practice
    row.insertCell().appendChild(createProgressDiv(280, undefined, `?/280 sessions completed`));
    // EEG T2
    row.insertCell().appendChild(createMarkableDiv(undefined, undefined));
    // MRI T2
    row.insertCell().appendChild(createMarkableDiv(undefined, undefined));
    // Daily Tasks T2
    row.insertCell().appendChild(createProgressDiv(280, finishedSetsT2, `${finishedSetsT2}/6 sets completed`));
}

async function initializeDashboard(db, client) {
    const users = await db.getAllParticipants();
    window.users = users;  // to-do: remove this (debug)
    for (const user of users) {
        const sets = await client.getSetsForUser(user.userId);
        const completedSetsT1 = sets.filter(s => s.experiment === "set-finished").length;
        addDashboardRow(user, completedSetsT1, 0);
    }
}

getAuth(
    session => {
        initializeDashboard(new Db({session: session}), new ApiClient(session));
    },
    err => {
        console.error("error:", err);
    }
).getSession();
