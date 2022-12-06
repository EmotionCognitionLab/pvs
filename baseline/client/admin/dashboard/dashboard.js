import "../../../../common/pay-info/style.css";
import { Payboard } from "pay-info";

export class Dashboard {
    constructor(tbody, client) {
        this.tbody = tbody;
        this.client = client;
        this.records = new Map();
        this.listen();
        this.allUsersLoadedSuccessfully = false;
    }

    async handleCheckboxEvent(event) {
        // determine if the click is trying to check or uncheck
        const checkbox = event.target;
        const checking = checkbox.checked;
        // handle the check/uncheck
        const span = checkbox.labels[0]?.querySelector("span");
        const key = checkbox.dataset.key;
        const userId = checkbox.closest("tr")?.dataset.userId;
        if (!span || !key || !userId) {
            throw new Error("malformed dashboard table body");
        }
        if (checkbox.indeterminate) {
            return;
        } else if (checking) {
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
    }

    async handleUserEvent(event) {
        event.stopPropagation();
        const parentRow = event.target.closest("[data-user-id]");
        const userId = parentRow.dataset.userId;
        const user = this.records.get(userId).user;
        // add basic user contact info to user detail display
        const userDetails = [user.email, user.phone_number, user.userId];
        const divs = userDetails.map(item => {
            const elem = document.createElement("div");
            elem.textContent = item;
            return elem;
        });
        // add user earnings to user detail display
        const payboardErrs = document.createElement("div");
        const payboardDiv = document.createElement("div");
        divs.push(payboardErrs);
        divs.push(payboardDiv);
        const payboard = new Payboard(
            payboardDiv,
            payboardErrs,
            this.client,
            user,
            true,
        );
        await payboard.init();
        const deetsDiv = Dashboard.getUserDetailsDiv();
        while (deetsDiv.childNodes.length > 1) {
            let toDelete = deetsDiv.childNodes[0];
            if (toDelete.id === "close-button") {
                if (deetsDiv.childNodes.length > 1) {
                    deetsDiv.removeChild(deetsDiv.childNodes[1]);
                }
            } else {
                deetsDiv.removeChild(toDelete);
            }
        }
        divs.forEach(div => deetsDiv.appendChild(div));
        deetsDiv.classList.remove("hidden");
    }

    listen() {
        // add checkbox click event listener to table body
        this.tbody.addEventListener("click", async event => {
            const target = event.target;
            if (target.type == "checkbox") {
                this.handleCheckboxEvent(event);
            } else if (target.className == "username") {
               await this.handleUserEvent(event);
            }
            return;
        });

        // hides the user details div when you click anywhere outside of it
        Dashboard.getUserDetailsDiv().addEventListener("click", (event) => {
            if (event.target.id !== "close-button") {
                event.stopPropagation();
                return false;
            }
            const deetsDiv = Dashboard.getUserDetailsDiv();
            if (!deetsDiv.classList.contains("hidden")) {
                deetsDiv.classList.add("hidden");
            }
        });
    }

    async refreshRecords() {
        // create and fill temporary array
        const temp = [];
        try {
            const users = await this.client.getAllParticipants();
            await Promise.all(users.map(async (user) => {
                const status = await this.client.getUserStatus(user.userId, user.humanId, user.preComplete, user.stage2Completed, user.stage2CompletedOn, user.homeComplete, user.postComplete);
                temp.push([
                    user.userId,
                    {
                        user,
                        status
                    },
                ]);
            }));
            this.allUsersLoadedSuccessfully = true;
        } catch (err) {
            console.error("Error loading all users", err);
        }

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

    static getUserDetailsDiv() {
        return document.getElementById("user-details");
    }

    appendRow(userId) {
        // prepare data
        const {
            user,
            status,
        } = this.records.get(userId);
        // insert row element
        const row = this.tbody.insertRow();
        // set row data attributes
        row.dataset.userId = userId;
        // add Subject ID cell
        const subjectCell = row.insertCell();
        const nameDiv = document.createElement("div");
        nameDiv.textContent = user.name;
        nameDiv.classList.add("username");
        subjectCell.append(nameDiv);
        const idDiv = document.createElement("div");
        idDiv.textContent = user.humanId;
        idDiv.classList.add("small");
        subjectCell.append(idDiv);
        const dateDiv = document.createElement("div");
        dateDiv.textContent = user.createdAt.substring(0, 10);
        dateDiv.classList.add("small");
        subjectCell.appendChild(dateDiv);
        const [preStatus, lumosBreathingStatus, postStatus] = Dashboard.buildStatusDivs(user.preComplete, user.homeComplete, user.postComplete, status);
        // Pre-Intervention Home Tasks Status

        row.insertCell().appendChild(preStatus);
        // Visit 1
        row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "visit1"));
        // Lumosity + Breathing Practice Status
        row.insertCell().appendChild(lumosBreathingStatus);
        // Visit 2
        row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "visit2"));
        // Visit 3
        row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "visit3"));
         // Visit 4
         row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "visit4"));
          // Visit 5
        row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "visit5"));
        // Post-Intervention Home Tasks Status
        row.insertCell().appendChild(postStatus);
        // dropped
        row.insertCell().appendChild(Dashboard.createMarkable(user.progress, "dropped"));
    }

    static buildStatusDivs(preComplete, homeComplete, postComplete, status) {
        const statusSpan = document.createElement("span");
        statusSpan.classList.add("dot");
        statusSpan.classList.add(status.status);
        if (Object.keys(status).length > 1) {
            // add tooltips for the other values
            let tipText = '';
            Object.entries(status).forEach(([k, v]) => {
                if (k !== 'status') {
                    tipText += `${k}: ${v}\n`;
                }
            });
            statusSpan.setAttribute('title', tipText);
        }
        if (!preComplete) return [statusSpan, Dashboard.textDiv("N/A"), Dashboard.textDiv("N/A")];
        if (!homeComplete) return [Dashboard.textDiv("Done"), statusSpan, Dashboard.textDiv("N/A")];
        if (!postComplete) return [Dashboard.textDiv("Done"), Dashboard.textDiv("Done"), statusSpan];
        return [Dashboard.textDiv("Done"), Dashboard.textDiv("Done"), Dashboard.textDiv("Done")];
    }

    static textDiv(text) {
        const newDiv = document.createElement("div");
        newDiv.textContent = text;
        return newDiv;
    }

    showUserDetails(userId) {
        const user = this.records.get(userId);
        const details = JSON.stringify(user);
        const deetsDiv = document.getElementById("user-details");
        deetsDiv.textContent = details;
        deetsDiv.classList.remove("hidden");
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
        if (!this.allUsersLoadedSuccessfully) {
            const errDiv = document.getElementById("error");
            errDiv.textContent = "Not all users were loaded. Please reload the page.";
        }
    }
}
