import { Dashboard } from "admin/dashboard/dashboard.js";
import { MockClient } from "./mock-client.js";

const users = [
    {
        computer: {
            "browser.name": "Magic",
            "os.name": "Horn",
            platform: "Horn",
            "screen.size": "1920x1080",
            ua: "Mozilla/5.0 (Horn; rv:97.0) Gecko/20100101 Magic/97.0",
        },
        createdAt: "2022-03-01T00:00:00.000Z",
        email: "bookhorse@example.com",
        humanId: "CuteWit",
        name: "Twilight Sparkle",
        phone_number: "+19990000000",
        phone_number_verified: true,
        preComplete: true,
        progress: {
            eegT1: "2022-03-04T00:00:00.000Z",
            mriT1: "2022-03-05T00:00:00.000Z",
        },
        userId: "95240257-42f9-4ae6-b989-0126f595e547",
    },
    {
        computer: {
            "browser.name": "Sense",
            "os.name": "Pinkie",
            platform: "Pinkie",
            "screen.size": "1080x1920",
            ua: "Mozilla/5.0 (Pinkie; rv:97.0) Gecko/20100101 Sense/97.0",
        },
        createdAt: "2022-03-01T12:00:00.000Z",
        email: "ponka.po@example.com",
        humanId: "PinkPie",
        name: "Pinkie Pie",
        phone_number: "+19990000001",
        phone_number_verified: false,
        userId: "693ab825-43d4-4e48-89f0-f9d7b03179af",
    },
    {
        computer: {
            "browser.name": "Hat",
            "os.name": "Apples",
            platform: "Apples",
            "screen.size": "1x1",
            ua: "Mozilla/5.0 (Apples; rv:97.0) Gecko/20100101 Hat/97.0",
        },
        createdAt: "2022-03-02T00:00:00.000Z",
        email: "apples@example.com",
        humanId: "FarmHat",
        name: "Applejack",
        phone_number: "+19990000002",
        phone_number_verified: true,
        userId: "1d84a646-db05-4093-8be5-41d1de595a6b",
    },
    {
        computer: {
            "browser.name": "Rainboom",
            "os.name": "Sonic",
            platform: "Sonic",
            "screen.size": "1366x768",
            ua: "Mozilla/5.0 (Sonic; rv:97.0) Gecko/20100101 Rainboom/97.0",
        },
        createdAt: "2022-03-02T12:00:00.000Z",
        email: "secretegghead@example.com",
        humanId: "FastAce",
        name: "Rainbow Dash",
        phone_number: "+19990000003",
        phone_number_verified: false,
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        computer: {
            "browser.name": "Spike",
            "os.name": "Dragon",
            platform: "Dragon",
            "screen.size": "3840x2160",
            ua: "Mozilla/5.0 (Dragon; rv:97.0) Gecko/20100101 Spike/97.0",
        },
        createdAt: "2022-03-03T00:00:00.000Z",
        email: "carousel-boutique@example.com",
        humanId: "ChicSew",
        name: "Rarity",
        phone_number: "+19990000004",
        phone_number_verified: true,
        userId: "d24dc34b-2c74-4d52-a7a1-1ec9577a9d00",
    },
    {
        computer: {
            "browser.name": "Angel",
            "os.name": "Bunny",
            platform: "Bunny",
            "screen.size": "800x600",
            ua: "Mozilla/5.0 (Bunny; rv:97.0) Gecko/20100101 Angel/97.0",
        },
        createdAt: "2022-03-03T12:00:00.000Z",
        email: "shhh@example.com",
        humanId: "SoftYay",
        name: "Fluttershy",
        phone_number: "+19990000005",
        phone_number_verified: true,
        userId: "597e8b3e-7907-4eae-a7da-b1abb25f5579",
    },
];

const results = [
    {
        experimentDateTime: "set-started|2022-03-02T13:00:00.000Z|0",
        identityId: "equestria-0:95240257-42f9-4ae6-b989-0126f595e547",
        userId: "95240257-42f9-4ae6-b989-0126f595e547",
    },
    {
        experimentDateTime: "set-started|2022-03-02T13:30:00.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-finished|2022-03-02T13:30:10.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-started|2022-03-02T13:30:20.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-finished|2022-03-02T13:30:30.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-started|2022-03-02T13:30:40.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-finished|2022-03-02T13:30:50.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-started|2022-03-02T13:31:00.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-finished|2022-03-02T13:31:10.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-started|2022-03-02T13:31:20.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-finished|2022-03-02T13:31:30.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-started|2022-03-02T13:31:40.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-finished|2022-03-02T13:31:50.000Z|0",
        identityId: "equestria-0:de7e842d-da61-4756-b120-61eca3e6ab11",
        userId: "de7e842d-da61-4756-b120-61eca3e6ab11",
    },
    {
        experimentDateTime: "set-finished|2022-03-02T14:0:00.000Z|0",
        identityId: "equestria-0:95240257-42f9-4ae6-b989-0126f595e547",
        userId: "95240257-42f9-4ae6-b989-0126f595e547",
    },
];

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
