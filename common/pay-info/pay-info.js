const StudyActivityStatus = Object.freeze({
    NOT_STARTED: 0,
    IN_PROGRESS: 1,
    COMPLETED: 2,
    DROPPED_OUT: 3,
});

const PaymentStatus = Object.freeze({
    NOT_YET_PROCESSED: 0,
    PROCESSED: 1,
});

export class Payboard {
    constructor(div, client, userId, admin = false) {
        this.div = div;
        this.client = client;
        this.userId = userId;
        this.admin = admin;
        // initialize payboard elements and their setters
        this.initializeElements();
    }

    initializeElements() {
        // add class to root div
        this.div.classList.add("pay-info");
        // add table to root div
        const table = document.createElement("table");
        this.div.appendChild(table);
        // add header to table
        const theadRow = table.createTHead().insertRow();
        const addTH = text => {
            const th = document.createElement("th");
            th.textContent = text;
            theadRow.appendChild(th);
        };
        addTH("Study Activity");
        addTH("Study Activity Status");
        addTH("Total Earned");
        addTH("Payment Status");
        // add body to table
        const tbody = table.createTBody();
        const addDivider = dividerText => {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.setAttribute("colspan", "3");
            cell.textContent = dividerText;
            cell.classList.add("pay-info-divider");
        };
        const addRow = studyActivityText => {
            const row = tbody.insertRow();
            const studyActivityCell = row.insertCell();
            studyActivityCell.textContent = studyActivityText;
            const studyActivityStatusCell = row.insertCell();
            const setStudyActivityStatus = studyActivityStatus => {
                studyActivityStatusCell.textContent = {
                    [StudyActivityStatus.NOT_STARTED]: "Not started",
                    [StudyActivityStatus.IN_PROGRESS]: "In progress",
                    [StudyActivityStatus.COMPLETED]: "Completed",
                    [StudyActivityStatus.DROPPED_OUT]: "Dropped out",
                }[studyActivityStatus];
                window.sasCell = studyActivityStatusCell;
                console.debug("INSIDE", window.sasCell.textContent);
            };
            const totalEarnedCell = row.insertCell();
            const setTotalEarned = totalEarnedDollars => {
                totalEarnedCell.textContent = `$${totalEarnedDollars}`;
            };
            return [setStudyActivityStatus, setTotalEarned];
        };
        addDivider("Pre-intervention activities ($155 Total)");
        [this.setDailyTasksT1Status, this.setDailyTasksT1Earned] = addRow("Daily tasks ($25)");
        [this.setEEGT1Status, this.setEEGT1Earned] = addRow("Lab visit #1 ($65)");
        [this.setMRIT1Status, this.setMRIT1Earned] = addRow("Lab visit #2 ($65)");
        addDivider("Intervention activity (up to $220 for daily practice plus bonus if earned)");
        [this.setSessionsStatus, this.setSessionsEarned] = addRow("Biofeedback practice");
        addDivider("Post-intervention activities (Part 1 - $130 Total)");
        [this.setEEGT2Status, this.setEEGT2Earned] = addRow("Lab visit #3 ($65)");
        [this.setMRIT2Status, this.setMRIT2Earned] = addRow("Lab visit #4 ($65)");
        addDivider("Post-intervention activities (Part 2 - $25 Total)");
        [this.setDailyTasksT2Status, this.setDailyTasksT2Earned] = addRow("Daily tasks ($25)");
        const paymentStatusCell = tbody.rows[0].insertCell();
        paymentStatusCell.setAttribute("rowspan", "11");
        const paymentStatusCellSpan = document.createElement("span");
        paymentStatusCell.appendChild(paymentStatusCellSpan);
        let paymentStatusCellSelect = null;
        if (this.admin) {
            paymentStatusCellSelect = document.createElement("select");
            paymentStatusCell.appendChild(paymentStatusCellSelect);
            const addOption = (value, label) => {
                const option = document.createElement("option");
                paymentStatusCellSelect.appendChild(option);
                option.value = value;
                option.label = label;
                return option;
            };
            addOption("", "--Update the status--").disabled = true;
            addOption(new String(PaymentStatus.NOT_YET_PROCESSED), "Not yet processed");
            addOption(new String(PaymentStatus.PROCESSED), "Processed");
        }
        this.setPaymentStatus = paymentStatus => {
            paymentStatusCellSpan.textContent = {
                [PaymentStatus.NOT_YET_PROCESSED]: "Not yet processed",
                [PaymentStatus.PROCESSED]: "Processed",
            }[paymentStatus];
            if (paymentStatusCellSelect) {
                paymentStatusCellSelect.value = new String(paymentStatus);
            }
        };
    }

    async refresh() {
        try {
            // get data
            const [user, sets, sessions] = await Promise.all([
                this.client.getUser(this.userId, true),
                this.client.getSetsForUser(this.userId),
                null,  // to-do
            ]);
            const finishedSetsCount = sets.filter(s => s.experiment === "set-finished").length;
            const finishedSetsT1Count = finishedSetsCount;
            const finishedSetsT2Count = 0;  // to-do
            const finishedSessionsCount = 0;  // to-do
            // call setters
            const SAS = StudyActivityStatus;
            this.setDailyTasksT1Status(
                finishedSetsT1Count <= 0 ? SAS.NOT_STARTED :
                finishedSetsT1Count < 6 ? SAS.IN_PROGRESS :
                SAS.COMPLETED
            );
            this.setDailyTasksT1Earned(finishedSetsT1Count >= 6 ? 25 : 0);
            this.setEEGT1Status(user.progress?.eegT1 ? SAS.COMPLETED : SAS.NOT_STARTED);
            this.setEEGT1Earned(user.progress?.eegT1 ? 65 : 0);
            this.setMRIT1Status(user.progress?.mriT1 ? SAS.COMPLETED : SAS.NOT_STARTED);
            this.setMRIT1Earned(user.progress?.mriT1 ? 65 : 0);
            this.setSessionsStatus(SAS.NOT_STARTED);  // to-do
            this.setSessionsEarned(0);  // to-do
            this.setEEGT2Status(user.progress?.eegT2 ? SAS.COMPLETED : SAS.NOT_STARTED);
            this.setEEGT2Earned(user.progress?.eegT2 ? 65 : 0);
            this.setMRIT2Status(user.progress?.mriT2 ? SAS.COMPLETED : SAS.NOT_STARTED);
            this.setMRIT2Earned(user.progress?.mriT2 ? 65 : 0);
            this.setDailyTasksT2Status(
                finishedSetsT2Count <= 0 ? SAS.NOT_STARTED :
                finishedSetsT2Count < 6 ? SAS.IN_PROGRESS :
                SAS.COMPLETED
            );
            this.setDailyTasksT2Earned(finishedSetsT2Count >= 6 ? 25 : 0);
            this.setPaymentStatus(
                !user.progress?.processed ? PaymentStatus.PROCESSED :
                PaymentStatus.NOT_YET_PROCESSED
            );
        } catch (err) {
            console.error(`error loading user: ${err}`);
        }
    }
}

export function getIdToken(session) {
    const jwt = session.getIdToken().getJwtToken();
    if (jwt) {
        const payload = jwt.split(".")[1];
        return JSON.parse(atob(payload));
    } else {
        throw new Error("bad JWT ${jwt}");
    }
}

export function isAdmin(idToken) {
    const preferredRole = idToken["cognito:preferred_role"];
    return preferredRole.split("/").slice(-1)[0] === "pvs-dev-study-admin";
}
