import { Dashboard } from "admin/dashboard/dashboard.js";
import { MockClient } from "./mock-client.js";
import { fakeUsers as users, fakeResults as results } from "./fakes.js";

function expectRowMatches(row, user, sets) {
    const [
        subjectCell,
        dailyTasksT1Cell,
        eegT1Cell,
        mriT1Cell,
        sessionsCell,
        eegT2Cell,
        mriT2Cell,
        dailyTasksT2Cell,
    ] = row.querySelectorAll("td");
    const finishedSetsCount = sets.filter(s => s.experiment === "set-finished").length;
    const finishedSetsT1Count = finishedSetsCount;  // to-do: fix this
    const finishedSetsT2Count = 0;  // to-do: fix this
    const finishedSessionsCount = 0;  // to-do: fix this
    expect(row.dataset.userId).toBe(user.userId);
    expect(subjectCell.querySelector(".username").textContent).toBe(user.name);
    expect(parseInt(dailyTasksT1Cell.querySelector("progress").value, 10)).toBe(finishedSetsT1Count);
    expect(eegT1Cell.querySelector("input").checked).toBe(Boolean(user.progress?.eegT1));
    expect(mriT1Cell.querySelector("input").checked).toBe(Boolean(user.progress?.mriT1));
    expect(parseInt(sessionsCell.querySelector("progress").value, 10)).toBe(finishedSessionsCount);
    expect(eegT2Cell.querySelector("input").checked).toBe(Boolean(user.progress?.eegT2));
    expect(mriT2Cell.querySelector("input").checked).toBe(Boolean(user.progress?.mriT2));
    expect(parseInt(dailyTasksT2Cell.querySelector("progress").value, 10)).toBe(finishedSetsT2Count);
}

describe("dashboard", () => {
    beforeEach(() => {
        jest.useFakeTimers("legacy");
        const dashboardWrapper = document.createElement("div");
        const dashboardError = document.createElement("div");
        const dashboardTable = document.createElement("table");
        const dashboardDetails = document.createElement("div");
        dashboardWrapper.id = "wrapper";
        dashboardError.id = "error";
        dashboardTable.id = "table";
        dashboardDetails.id = "user-details";
        dashboardWrapper.appendChild(dashboardError);
        dashboardWrapper.appendChild(dashboardTable);
        dashboardWrapper.appendChild(dashboardDetails);
        document.body.appendChild(dashboardWrapper);
    });
    const getDashboardElements = () => ({
        wrapper: document.querySelector("#wrapper"),
        error: document.querySelector("#error"),
        table: document.querySelector("#table"),
        details: document.querySelector("#details"),
    });
    afterEach(() => {
        document.querySelector("body > div").remove();
    });

    it("cells display correct data", async () => {
        const {wrapper, error, table, details} = getDashboardElements();
        const mc = new MockClient(users, results);
        const dash = new Dashboard(table, mc);
        await dash.refreshRecords();
        dash.showActive();
        const rows = Array.from(document.querySelectorAll("tr"));
        expect(rows.length).toBe(users.length);
        //for (const user of users) {  // `unknown Statement of type "ForOfStatement"` Babel error?
        for (let i = 0; i < users.length; ++i) {
            const user = users[i];
            const row = document.querySelector(`[data-user-id="${user.userId}"]`);
            expectRowMatches(row, user, await mc.getSetsForUser(user.userId));
        }
    });

    it("updates displayed data on refresh", async () => {
        const spike = {
            computer: {
                "browser.name": "Dragonfire",
                "os.name": "Dragon",
                platform: "Dragon",
                "screen.size": "256x192",
                ua: "Mozilla/5.0 (Dragon; rv:97.0) Gecko/20100101 Dragonfire/97.0",
            },
            createdAt: "2022-03-04T00:00:00.000Z",
            email: "bestassistant@example.com",
            humanId: "SmolDog",
            name: "Spike",
            phone_number: "+19990000006",
            phone_number_verified: false,
            userId: "ea1623c7-834e-47d7-bdda-6c665978128b",
        };
        // create dashboard without Spike
        const mc = new MockClient(users, results);
        const {wrapper, error, table, details} = getDashboardElements();
        const dash = new Dashboard(table, mc);
        await dash.refreshRecords();
        dash.showActive();
        expect(document.querySelector(`[data-user-id="${spike.userId}"]`)).toBeNull();
        // add Spike
        mc.users.set(spike.userId, spike);
        await dash.refreshRecords();
        dash.showActive();
        const spikeRow = document.querySelector(`[data-user-id="${spike.userId}"]`);
        expect(spikeRow).not.toBeNull();
        expectRowMatches(spikeRow, spike, await mc.getSetsForUser(spike.userId));
    });

    it("updates backend through client on check", async () => {
        // current date
        const date = new Date(2010, 9, 10);
        const dateSpy = jest.spyOn(global, "Date").mockImplementation(() => date);
        // create dashboard
        const mc = new MockClient(users, results);
        const {wrapper, error, table, details} = getDashboardElements();
        const dash = new Dashboard(table, mc);
        await dash.refreshRecords();
        dash.showActive();
        // Fluttershy should not have a timestamp for EEG T1
        const fluttershyId = "597e8b3e-7907-4eae-a7da-b1abb25f5579";
        const fluttershyRow = document.querySelector(`[data-user-id="${fluttershyId}"]`);
        const [_, __, eegT1Cell, ...___] = fluttershyRow.querySelectorAll("td");
        expect(mc.users.get(fluttershyId).progress?.eegT1).toBeFalsy();
        expect(eegT1Cell.querySelector("input").checked).toBe(false);
        expect(eegT1Cell.querySelector("span").textContent).toBeFalsy();
        // check Fluttershy's EEG T1 checkbox
        eegT1Cell.querySelector("input").dispatchEvent(new MouseEvent("click", {bubbles: true}));
        // wait for the async click event handler to resolve
        await new Promise(process.nextTick);
        // Fluttershy should now have a timestamp for EEG T1
        expect(mc.users.get(fluttershyId).progress?.eegT1).toBeTruthy();  // backend is updated
        expect(eegT1Cell.querySelector("input").checked).toBe(true);  // checkbox is checked
        expect(eegT1Cell.querySelector("span").textContent).toBe("2010-10-10");  // timestamp is displayed
        expect(dateSpy).toHaveBeenCalledTimes(1);
        // restore mocks
        dateSpy.mockRestore();
    });

    it("updates backend through client on uncheck", async () => {
        // mock window.confirm
        const confirmSpy = jest.spyOn(window, "confirm").mockImplementation(() => true);
        // create dashboard
        const mc = new MockClient(users, results);
        const {wrapper, error, table, details} = getDashboardElements();
        const dash = new Dashboard(table, mc);
        await dash.refreshRecords();
        dash.showActive();
        // Twilight Sparkle should have a timestamp for MRI T1
        const twiId = "95240257-42f9-4ae6-b989-0126f595e547";
        const twiRow = document.querySelector(`[data-user-id="${twiId}"]`);
        const [_, __, ___, mriT1Cell, ...____] = twiRow.querySelectorAll("td");
        expect(mc.users.get(twiId).progress?.mriT1).toBeTruthy();
        expect(mriT1Cell.querySelector("input").checked).toBe(true);
        expect(mriT1Cell.querySelector("span").textContent).toBeTruthy();
        // uncheck Twilight Sparkle's MRI T1 checkbox
        mriT1Cell.querySelector("input").dispatchEvent(new MouseEvent("click", {bubbles: true}));
        // wait for the async click event handler to resolve
        await new Promise(process.nextTick);
        // Twilight Sparkle should no longer have a timestamp for MRI T1
        expect(mc.users.get(twiId).progress?.mriT1).toBeFalsy();  // backend is updated
        expect(mriT1Cell.querySelector("input").checked).toBe(false);  // checkbox is unchecked
        expect(mriT1Cell.querySelector("span").textContent).toBeFalsy();  // timestamp is removed
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        // restore mocks
        confirmSpy.mockRestore();
    });
});
