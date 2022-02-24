import "./style.css";
import { getAuth } from "auth/auth.js";
import ApiClient from "../../api/client";
import Db from "db/db.js";

class Dashboard {
    constructor(tbody, client, db) {
        this.tbody = tbody;
        this.client = client;
        this.db = db;
        this.records = new Map();
        this.listen();
    }

    listen() {
        // add checkbox click event listener to table body
        this.tbody.addEventListener("click", event => {
            const checkbox = event.target;
            if (checkbox.type !== "checkbox") {
                return;
            }
            event.preventDefault();
            const span = checkbox.labels[0]?.querySelector("span");
            const key = checkbox.dataset.key;
            const userId = checkbox.closest("tr")?.dataset.userId;
            if (!span || !key || !userId) {
                throw new Error("malformed dashboard table body");
            }
            // run logic after event is fully canceled (to make checkbox state reasonable)
            setTimeout(async () => {
                if (checkbox.indeterminate) {
                    return;
                } else if (!checkbox.checked) {
                    Dashboard.disableMarkable(checkbox, span);
                    try {
                        const user = await this.refreshUser(userId);
                        const progress = user.progress ?? {};
                        if (!progress[key]) {
                            // timestamp for key can be set
                            progress[key] = (new Date()).toISOString();
                            await this.client.updateUser(userId, {progress});
                            this.records.get(userId).user.progress = progress;
                        }
                        Dashboard.setMarkable(checkbox, span, progress[key]);
                    } catch (err) {
                        console.error(`Error setting date for ${key} for ${userId}`, err);
                        window.alert("A problem occurred. Please try again later.");
                        Dashboard.clearMarkable(checkbox, span);
                    }
                } else if (window.confirm("Unset this timestamp?")) {
                    const timestamp = span.textContent;
                    Dashboard.disableMarkable(checkbox, span);
                    try {
                        const user = await this.refreshUser(userId);
                        const progress = user.progress ?? {};
                        if (progress[key]) {
                            delete progress[key];
                            await this.client.updateUser(userId, {progress});
                            this.records.get(userId).user.progress = progress;
                        }
                        Dashboard.clearMarkable(checkbox, span);
                    } catch (err) {
                        console.error(`Error clearing date for ${key} for ${userId}`, err);
                        window.alert("A problem occurred. Please try again later.");
                        Dashboard.setMarkable(checkbox, span, timestamp);
                    }
                }
            });
        });
    }

    async refreshRecords() {
        // create and fill temporary new map
        const temp = [];
        const users = await this.db.getAllParticipants();
        await Promise.all(users.map(async (user) => {
            const sets = await this.client.getSetsForUser(user.userId);
            const finishedSets = sets.filter(s => s.experiment === "set-finished").length;
            const finishedSetsT1 = finishedSets;
            const finishedSetsT2 = 0;  // to-do: fix this
            const finishedSessions = 0;  // to-do: fix this
            temp.push([user.userId, {user, finishedSetsT1, finishedSetsT2, finishedSessions}]);
        }));
        // sort temporary and copy to records
        const sorted = temp.sort(([_userId1, user1], [_userId2, user2]) => user1.user.name.localeCompare(user2.user.name));
        this.records.clear();
        for (const [key, value] of sorted) {
            this.records.set(key, value);
        }
    }

    async refreshUser(userId) {
        const user = await this.client.getUser(userId, true);
        this.records.get(userId).user = user;
        return user;
    }

    static createProgress(max, value, plural) {
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
    }

    static disableMarkable(checkbox, span) {
        checkbox.disabled = true;
        checkbox.indeterminate = true;
        span.textContent = "...";
    }
    static clearMarkable(checkbox, span) {
        checkbox.disabled = false;
        checkbox.indeterminate = false;
        checkbox.checked = false;
        span.textContent = "";
    }
    static setMarkable(checkbox, span, timestamp) {
        checkbox.disabled = false;
        checkbox.indeterminate = false;
        checkbox.checked = true;
        span.textContent = timestamp.substring(0, 10);
    }
    static createMarkable(progress, key) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.key = key;
        const span = document.createElement("span");
        const label = document.createElement("label");
        label.appendChild(checkbox);
        label.appendChild(span);
        if (progress?.[key]) {
            Dashboard.setMarkable(checkbox, span, progress?.[key]);
        } else {
            Dashboard.clearMarkable(checkbox, span);
        }
        return label;
    }

    appendRow(userId) {
        // prepare data
        const {user, finishedSetsT1, finishedSetsT2, finishedSessions} = this.records.get(userId);
        // insert row element
        const row = this.tbody.insertRow();
        // set row data attributes
        row.dataset.userId = userId;
        // add Subject ID cell
        const subjectCell = row.insertCell();
        subjectCell.textContent = user.name;
        const dateSpan = document.createElement("span");
        dateSpan.textContent = user.createdAt.substring(0, 10);
        dateSpan.classList.add("small");
        subjectCell.appendChild(dateSpan);
        // Daily Tasks T1
        row.insertCell().appendChild(Dashboard.createProgress(6, finishedSetsT1, "sets"));
        // EEG T1
        row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "eegT1"));
        // MRI T1
        row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "mriT1"));
        // Biofeedback Practice
        row.insertCell().appendChild(Dashboard.createProgress(280, finishedSessions, "sessions"));
        // EEG T2
        row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "eegT2"));
        // MRI T2
        row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "mriT2"));
        // Daily Tasks T2
        row.insertCell().appendChild(Dashboard.createProgress(6, finishedSetsT2, "sets"));
    }

    clearRows() {
        while (this.tbody.firstChild) {
            this.tbody.firstChild.remove();
        }
    }

    showActive() {
        this.clearRows();
        for (const userId of this.records.keys()) {
            this.appendRow(userId);
        }
    }
}

getAuth(
    async session => {
        const dashboard = new Dashboard(
            document.querySelector("#dashboard > tbody"),
            new ApiClient(session),
            new Db({session: session}),
        );
        await dashboard.refreshRecords();
        dashboard.showActive();
    },
    err => {
        console.error("error:", err);
    },
).getSession();
