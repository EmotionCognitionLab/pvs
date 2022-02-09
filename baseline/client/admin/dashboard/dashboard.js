import "./style.css";

const dashboardBody = document.querySelector("#dashboard > tbody");

function addDashboardRow(user, completedSetsT1, completedSetsT2) {
    const row = dashboardBody.insertRow();
    row.insertCell().textContent = "NAME";
    const progressSetsT1 = document.createElement("progress")
    row.insertCell().appendChild(progressSetsT1);
}

addDashboardRow(undefined, undefined, undefined);
