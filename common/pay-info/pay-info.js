import payboardHTML from "./payboard.html";

const StudyActivityStatus = Object.freeze({
    NOT_STARTED: "not-started",
    IN_PROGRESS: "in-progress",
    COMPLETED: "completed",
    DROPPED_OUT: "dropped-out",
});

export const PaymentStatus = Object.freeze({
    NOT_YET_PROCESSED: "unprocessed",
    PROCESSED: "processed",
});

export class Payboard {
    constructor(rootDiv, errorDiv, client, userId, admin = false) {
        this.rootDiv = rootDiv;
        this.errorDiv = errorDiv;
        this.client = client;
        this.userId = userId;
        this.admin = admin;
        // initialize payboard elements and their setters
        this.initializeElements();
    }

    initializeElements() {
        // set class of root div
        this.rootDiv.classList.add("pay-info");
        // set inner HTML of root div
        this.rootDiv.innerHTML = payboardHTML;
        // add setter for name
        const nameSpan = this.rootDiv.querySelector(".pay-info-name");
        this.setName = name => {
            nameSpan.textContent = name;
        };
        // add setters for rows
        const rowSetters = row => {
            const studyActivityStatusCell = row.querySelector(".pay-info-study-activity-status");
            const setStudyActivityStatus = studyActivityStatus => {
                studyActivityStatusCell.textContent = {
                    [StudyActivityStatus.NOT_STARTED]: "Not started",
                    [StudyActivityStatus.IN_PROGRESS]: "In progress",
                    [StudyActivityStatus.COMPLETED]: "Completed",
                    [StudyActivityStatus.DROPPED_OUT]: "Dropped out",
                }[studyActivityStatus];
            };
            const totalEarnedCell = row.querySelector(".pay-info-total-earned");
            const setTotalEarned = totalEarnedDollars => {
                totalEarnedCell.textContent = `$${totalEarnedDollars}`;
            };
            return [setStudyActivityStatus, setTotalEarned];
        };
        const [
            dailyTasksT1Row,
            eegT1Row,
            mriT1Row,
            sessionsRow,
            eegT2Row,
            mriT2Row,
            dailyTasksT2Row,
        ] = this.rootDiv.querySelectorAll(".pay-info-row");
        [this.setDailyTasksT1Status, this.setDailyTasksT1Earned] = rowSetters(dailyTasksT1Row);
        [this.setEEGT1Status, this.setEEGT1Earned] = rowSetters(eegT1Row);
        [this.setMRIT1Status, this.setMRIT1Earned] = rowSetters(mriT1Row);
        [this.setSessionsStatus, this.setSessionsEarned] = rowSetters(sessionsRow);
        [this.setEEGT2Status, this.setEEGT2Earned] = rowSetters(eegT2Row);
        [this.setMRIT2Status, this.setMRIT2Earned] = rowSetters(mriT2Row);
        [this.setDailyTasksT2Status, this.setDailyTasksT2Earned] = rowSetters(dailyTasksT2Row);
        // add payment status
        const addPaymentStatus = (cell, progressKey) => {
            const span = cell.querySelector("span");
            // add select if admin
            let select = null;
            if (this.admin) {
                select = document.createElement("select");
                cell.appendChild(select);
                const addOption = (value, label) => {
                    const option = document.createElement("option");
                    select.appendChild(option);
                    option.value = new String(value);
                    option.label = label;
                    return option;
                };
                addOption("", "--Update the status--").disabled = true;
                addOption(new String(PaymentStatus.NOT_YET_PROCESSED), "Not yet processed");
                addOption(new String(PaymentStatus.PROCESSED), "Processed");
            }
            // create setter
            let currentValue = null;
            const setPaymentStatus = paymentStatus => {
                currentValue = paymentStatus;
                span.textContent = {
                    [PaymentStatus.NOT_YET_PROCESSED]: "Not yet processed",
                    [PaymentStatus.PROCESSED]: "Processed",
                }[paymentStatus];
                if (this.admin) {
                    select.value = new String(paymentStatus);
                    select.disabled = false;
                }
            };
            // add listener if admin
            if (this.admin) {
                select.addEventListener("change", async event => {
                    if (select.value !== currentValue) {
                        const value = select.value;
                        select.disabled = true;
                        try {
                            const progress = (await this.client.getUser(this.userId, true)).progress ?? {};
                            if (progress[progressKey]?.value !== value) {
                                progress[progressKey] = {
                                    value,
                                    timestamp: (new Date()).toISOString(),
                                };
                                await this.client.updateUser(this.userId, {progress});
                            }
                            setPaymentStatus(value);
                        } catch (err) {
                            this.handleError(err);
                            setPaymentStatus(currentValue);
                        }
                    }
                });
            }
            return setPaymentStatus;
        };
        const paymentStatusCell = this.rootDiv.querySelector(".pay-info-payment-status");
        this.setPaymentStatus = addPaymentStatus(paymentStatusCell, "paymentStatus");
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
            this.setName(user.name);
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
                user.progress?.paymentStatus?.value === PaymentStatus.PROCESSED ? PaymentStatus.PROCESSED :
                PaymentStatus.NOT_YET_PROCESSED
            );
        } catch (err) {
            this.handleError(err);
        }
    }

    handleError(err) {
        console.error(`error: ${err}`);
        this.errorDiv.textContent = `error: ${err.message ?? err}`;
    }
}
