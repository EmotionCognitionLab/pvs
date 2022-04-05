import { Payboard, PaymentStatus } from "../pay-info.js";
import { MockClient } from "../../../baseline/client/tests/mock-client.js";
import { fakeUsers as users, fakeResults as results } from "../../../baseline/client/tests/fakes.js";

function expectPayboardMatches(payboard, user, sets) {
    const [
        dividerA,
        dailyTasksT1Row,
        eegT1Row,
        mriT1Row,
        dividerB,
        sessionsRow,
        dividerC,
        eegT2Row,
        mriT2Row,
        dividerD,
        dailyTasksT2Row,
    ] = payboard.rootDiv.querySelectorAll("tbody tr");
    const paymentStatusCell = dividerA.querySelector("td:last-of-type");
    const [dailyTasksT1StatusCell, dailyTasksT1EarnedCell] = dailyTasksT1Row.querySelectorAll("td:not(:first-child)");
    const [eegT1StatusCell, eegT1EarnedCell] = eegT1Row.querySelectorAll("td:not(:first-child)");
    const [mriT1StatusCell, mriT1EarnedCell] = mriT1Row.querySelectorAll("td:not(:first-child)");
    const [sessionsStatusCell, sessionsEarnedCell] = sessionsRow.querySelectorAll("td:not(:first-child)");
    const [eegT2StatusCell, eegT2EarnedCell] = eegT2Row.querySelectorAll("td:not(:first-child)");
    const [mriT2StatusCell, mriT2EarnedCell] = mriT2Row.querySelectorAll("td:not(:first-child)");
    const [dailyTasksT2StatusCell, dailyTasksT2EarnedCell] = dailyTasksT2Row.querySelectorAll("td:not(:first-child)");
    // table elements should be generated
    expect([
        paymentStatusCell,
        dailyTasksT1StatusCell, dailyTasksT1EarnedCell,
        eegT1StatusCell, eegT1EarnedCell,
        mriT1StatusCell, mriT1EarnedCell,
        sessionsStatusCell, sessionsEarnedCell,
        eegT2StatusCell, eegT2EarnedCell,
        mriT2StatusCell, mriT2EarnedCell,
        dailyTasksT2StatusCell, dailyTasksT2EarnedCell,
    ].every(e => e)).toBe(true);
    // get completed sets
    const finishedSetsCount = sets.filter(s => s.experiment === "set-finished").length;
    const finishedSetsT1Count = finishedSetsCount;  // to-do: fix this
    const finishedSetsT2Count = 0;  // to-do: fix this
    const finishedSessionsCount = 0;  // to-do: fix this
    // row cells should contain correct text
    if (finishedSetsT1Count <= 0) {
        expect(dailyTasksT1StatusCell.textContent).toContain("Not started");
        expect(dailyTasksT1EarnedCell.textContent).toContain("$0");
    } else if (finishedSetsT1Count < 6) {
        expect(dailyTasksT1StatusCell.textContent).toContain("In progress");
        expect(dailyTasksT1EarnedCell.textContent).toContain("$0");
    } else {
        expect(dailyTasksT1StatusCell.textContent).toContain("Completed");
        expect(dailyTasksT1EarnedCell.textContent).toContain("$25");
    }
    if (!user.progress?.eegT1) {
        expect(eegT1StatusCell.textContent).toContain("Not started");
        expect(eegT1EarnedCell.textContent).toContain("$0");
    } else {
        expect(eegT1StatusCell.textContent).toContain("Completed");
        expect(eegT1EarnedCell.textContent).toContain("$65");
    }
    if (!user.progress?.mriT1) {
        expect(mriT1StatusCell.textContent).toContain("Not started");
        expect(mriT1EarnedCell.textContent).toContain("$0");
    } else {
        expect(mriT1StatusCell.textContent).toContain("Completed");
        expect(mriT1EarnedCell.textContent).toContain("$65");
    }
    // to-do: check sessions
    if (!user.progress?.eegT2) {
        expect(eegT2StatusCell.textContent).toContain("Not started");
        expect(eegT2EarnedCell.textContent).toContain("$0");
    } else {
        expect(eegT2StatusCell.textContent).toContain("Completed");
        expect(eegT2EarnedCell.textContent).toContain("$65");
    }
    if (!user.progress?.mriT2) {
        expect(mriT2StatusCell.textContent).toContain("Not started");
        expect(mriT2EarnedCell.textContent).toContain("$0");
    } else {
        expect(mriT2StatusCell.textContent).toContain("Completed");
        expect(mriT2EarnedCell.textContent).toContain("$65");
    }
    if (finishedSetsT2Count <= 0) {
        expect(dailyTasksT2StatusCell.textContent).toContain("Not started");
        expect(dailyTasksT2EarnedCell.textContent).toContain("$0");
    } else if (finishedSetsT2Count < 6) {
        expect(dailyTasksT2StatusCell.textContent).toContain("In progress");
        expect(dailyTasksT2EarnedCell.textContent).toContain("$0");
    } else {
        expect(dailyTasksT2StatusCell.textContent).toContain("Completed");
        expect(dailyTasksT2EarnedCell.textContent).toContain("$25");
    }
    // payment status span and select should be set correctly
    const paymentStatusSpan = paymentStatusCell.querySelector("span");
    const paymentStatusSelect = paymentStatusCell.querySelector("select");
    if (user.progress?.paymentStatus?.value !== PaymentStatus.PROCESSED) {
        expect(paymentStatusSpan.textContent).toContain("Not yet processed");
        if (paymentStatusSelect) {
            expect(paymentStatusSelect.value).toBe(PaymentStatus.NOT_YET_PROCESSED);
        }
    } else {
        expect(paymentStatusSpan.textContent).toContain("Processed");
        if (paymentStatusSelect) {
            expect(paymentStatusSelect.value).toBe(PaymentStatus.PROCESSED);
        }
    }
}

describe("Payboard", () => {
    beforeEach(() => {
        jest.useFakeTimers("legacy");
        const root = document.createElement("div");
        root.id = "root";
        const error = document.createElement("div");
        error.id = "error";
        document.body.appendChild(root);
        document.body.appendChild(error);
    });
    const getPayboardElements = () => ({
        root: document.querySelector("#root"),
        error: document.querySelector("#error"),
    });
    afterEach(() => {
        document.querySelectorAll("body > div").forEach(e => {
            e.remove();
        });
    });

    it.each(users)(
        "cells display correct data for user %p",
        async user => {
            const {root, error} = getPayboardElements();
            const mc = new MockClient(users, results);
            const payboard = new Payboard(root, error, mc, user.userId, true);
            await payboard.refresh();
            expectPayboardMatches(payboard, user, await mc.getSetsForUser(user.userId));
        },
    );

    it("updates displayed data on refresh", async () => {
        const twiId = users[0].userId;
        // create payboard without changes
        const mc = new MockClient(users, results);
        const {root, error} = getPayboardElements();
        const payboard = new Payboard(root, error, mc, twiId, true);
        await payboard.refresh();
        expectPayboardMatches(payboard, mc.users.get(twiId), await mc.getSetsForUser(twiId));
        // unset Twilight's mriT2 progress
        mc.users.get(twiId).progress = undefined;
        await payboard.refresh();
        expectPayboardMatches(payboard, mc.users.get(twiId), await mc.getSetsForUser(twiId));
    });

    it("dropdown select doesn't appear without admin privileges", async () => {
        const mc = new MockClient(users, results);
        const {root, error} = getPayboardElements();
        const payboard = new Payboard(root, error, mc, users[0].userId, false);
        await payboard.refresh();
        expect(document.querySelector("select")).toBeNull();
    });

    it("dropdown select appears with admin privileges", async () => {
        const mc = new MockClient(users, results);
        const {root, error} = getPayboardElements();
        const payboard = new Payboard(root, error, mc, users[0].userId, true);
        await payboard.refresh();
        expect(document.querySelector("select")).not.toBeNull();
    });

    it("changing dropdown select updates backend through client", async () => {
        const twiId = users[0].userId;
        const mc = new MockClient(users, results);
        const {root, error} = getPayboardElements();
        const payboard = new Payboard(root, error, mc, twiId, true);
        await payboard.refresh();
        const select = document.querySelector("select");
        // set Twi's paymentStatus from not yet processed to processed
        expect(select.value).toBe(PaymentStatus.NOT_YET_PROCESSED);
        select.value = PaymentStatus.PROCESSED;
        select.dispatchEvent(new Event("change"));
        await new Promise(process.nextTick);
        expect(mc.users.get(twiId).progress.paymentStatus.value).toBe(PaymentStatus.PROCESSED);
        // set Twi's paymentStatus from processed to not yet processed
        expect(select.value).toBe(PaymentStatus.PROCESSED);
        select.value = PaymentStatus.NOT_YET_PROCESSED;
        select.dispatchEvent(new Event("change"));
        await new Promise(process.nextTick);
        expect(
            mc.users.get(twiId).progress?.paymentStatus?.value !== PaymentStatus.PROCESSED
        ).toBe(true);
    });

    it("error thrown on select change reverts select state", async () => {
        const twiId = users[0].userId;
        // make mock client throw on update
        const mc = new MockClient(users, results);
        mc.updateUser = () => {
            throw new Error("oops");
        };
        const {root, error} = getPayboardElements();
        const payboard = new Payboard(root, error, mc, twiId, true);
        await payboard.refresh();
        const select = document.querySelector("select");
        expect(select.value).toBe(PaymentStatus.NOT_YET_PROCESSED);
        select.value = PaymentStatus.PROCESSED;
        // attempt to change select
        select.dispatchEvent(new Event("change"));
        await new Promise(process.nextTick);
        // error should be handled
        expect(select.value).toBe(PaymentStatus.NOT_YET_PROCESSED);
        expect(error.textContent).toContain("oops");
    });
});
