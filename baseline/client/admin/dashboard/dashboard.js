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

function addDashboardRow(client, user, finishedSetsT1, finishedSetsT2, finishedSessions) {
    // insert row element
    const row = dashboardBody.insertRow();
    // helper for cells that contain progress bars
    const createProgress = (max, value, plural) => {
        const progress = document.createElement("progress");
        progress.setAttribute("max", String(max));
        progress.setAttribute("value", String(value));
        const label = document.createElement("label");
        label.textContent = `${value}/${max} ${plural} completed`;
        label.appendChild(progress);
        const span = document.createElement("span");
        span.textContent = `${Math.round(100*value/max)}%`;
        const div = document.createElement("div");
        div.appendChild(label);
        div.appendChild(span);
        return div;
    };
    // helper for cells that contain a markable date
    const createMarkable = key => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        const text = document.createTextNode("");
        const label = document.createElement("label");
        label.appendChild(checkbox);
        label.appendChild(text);
        const clear = () => {
            checkbox.disabled = false;
            checkbox.indeterminate = false;
            checkbox.checked = false;
            text.textContent = "";
        };
        const set = timestamp => {
            checkbox.disabled = false;
            checkbox.indeterminate = false;
            checkbox.checked = true;
            text.textContent = timestamp;
        };
        const disable = () => {
            checkbox.disabled = true;
            checkbox.indeterminate = true;
            text.textContent = "...";
        };
        checkbox.addEventListener("click", event => {
            event.preventDefault();
            setTimeout(() => {
                if (checkbox.indeterminate) {
                    return;
                } else if (!checkbox.checked) {
                    disable();
                    (async () => {
                        const u = await client.getUser(user.userId, true);
                        const progress = u.progress ?? {};
                        if (!progress[key]) {
                            progress[key] = (new Date()).toISOString();
                            await client.updateUser(user.userId, {progress});
                        }
                        set(progress[key]);
                    })();
                } else if (window.confirm("yeah?")) {
                    disable();
                    (async () => {
                        const u = await client.getUser(user.userId, true);
                        const progress = u.progress ?? {};
                        if (progress[key]) {
                            delete progress[key];
                            await client.updateUser(user.userId, {progress});
                        }
                        clear();
                    })();
                }
            });
        });
        if (user.progress?.[key]) {
            set(user.progress?.[key]);
        } else {
            clear();
        }
        return label;
    };
    // add Subject ID cell
    row.insertCell().textContent = user.name;
    // Daily Tasks T1
    row.insertCell().appendChild(createProgress(6, finishedSetsT1, "sets"));
    // EEG T1
    row.insertCell().appendChild(createMarkable("eegT1"));
    // MRI T1
    row.insertCell().appendChild(createMarkable("mriT1"));
    // Biofeedback Practice
    row.insertCell().appendChild(createProgress(280, finishedSessions, "sessions"));
    // EEG T2
    row.insertCell().appendChild(createMarkable("eegT2"));
    // MRI T2
    row.insertCell().appendChild(createMarkable("mriT2"));
    // Daily Tasks T2
    row.insertCell().appendChild(createProgress(280, finishedSetsT2, "sets"));
}

async function initializeDashboard(db, client) {
    const users = await db.getAllParticipants();
    for (const user of users) {
        const sets = await client.getSetsForUser(user.userId);
        const completedSetsT1 = sets.filter(s => s.experiment === "set-finished").length;
        addDashboardRow(client, user, completedSetsT1, 0, 0);
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
