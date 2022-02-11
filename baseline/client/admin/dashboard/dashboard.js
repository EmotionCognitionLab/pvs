import "./style.css";

const dashboardBody = document.querySelector("#dashboard > tbody");

function clearDashboard() {
    while (dashboardBody.firstChild) {
        dashboardBody.firstChild.remove();
    }
}

function addDashboardRow(user, completedSetsT1, completedSetsT2) {
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
    row.insertCell().textContent = "NAME";
    // Daily Tasks T1
    row.insertCell().appendChild(createProgressDiv(6, undefined, `Set ?/6 completed`));
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
    row.insertCell().appendChild(createProgressDiv(280, undefined, `Set ?/6 completed`));
}

for (let i = 0; i < 5; ++i) {
    addDashboardRow(undefined, undefined, undefined);
}
