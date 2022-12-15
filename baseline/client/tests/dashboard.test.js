import { Dashboard } from "admin/dashboard/dashboard.js";
import { MockClient } from "./mock-client.js";
import { fakeUsers as users } from "./fakes.js";

function expectRowMatches(row, user) {
    const [
        subjectCell,
        dailyTasksT1Cell,
        visit1Cell,
        visit2Cell,
        lumosBreathStatusCell,
        visit3Cell,
        visit4Cell,
        visit5Cell,
        dailyTasksT2Cell,
        droppedCell,
    ] = row.querySelectorAll("td");
    expect(row.dataset.userId).toBe(user.userId);
    expect(subjectCell.querySelector(".username").textContent).toBe(user.name);
    expect(visit1Cell.querySelector("input").checked).toBe(Boolean(user.progress?.visit1));
    expect(visit2Cell.querySelector("input").checked).toBe(Boolean(user.progress?.visit2));

    const status = user.status.status;
    const lumosStatus = user.status.lumosity;
    const breathStatus = user.status.breathing;
    if (user.preComplete) {
        expect(dailyTasksT1Cell.textContent).toBe("Done");
        if (!user.homeComplete) {
            expect(lumosBreathStatusCell.innerHTML).toBe(`<span class="dot ${status}" title="lumosity: ${lumosStatus}\nbreathing: ${breathStatus}\n"></span>`);
        } else {
            expect(lumosBreathStatusCell.textContent).toBe('Done');
            if (!user.postComplete) {
                expect(dailyTasksT2Cell.innerHTML).toBe(`<span class="dot ${status}"></span>`);
            } else {
                expect(dailyTasksT2Cell.textContent).toBe('Done');
            }
            
        }
    } else {
        expect(dailyTasksT1Cell.innerHTML).toBe(`<span class="dot ${status}"></span>`);
        expect(lumosBreathStatusCell.textContent).toBe("N/A");
        expect(dailyTasksT2Cell.textContent).toBe("N/A");
    }

    expect(visit3Cell.querySelector("input").checked).toBe(Boolean(user.progress?.visit3));
    expect(visit4Cell.querySelector("input").checked).toBe(Boolean(user.progress?.visit4));
    expect(visit5Cell.querySelector("input").checked).toBe(Boolean(user.progress?.visit5));
    expect(droppedCell.querySelector("input").checked).toBe(Boolean(user.progress?.dropped));
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
        const mc = new MockClient(users);
        const dash = new Dashboard(table, mc);
        await dash.refreshRecords();
        dash.showActive();
        const rows = Array.from(document.querySelectorAll("tr"));
        expect(rows.length).toBe(users.length);
        //for (const user of users) {  // `unknown Statement of type "ForOfStatement"` Babel error?
        for (let i = 0; i < users.length; ++i) {
            const user = users[i];
            const row = document.querySelector(`[data-user-id="${user.userId}"]`);
            expectRowMatches(row, user);
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
            status: {
                status: 'red'
            }
        };
        // create dashboard without Spike
        const mc = new MockClient(users);
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
        expectRowMatches(spikeRow, spike);
    });

    it("updates backend through client on check", async () => {
        // current date
        const date = new Date(2010, 9, 10);
        const dateSpy = jest.spyOn(global, "Date").mockImplementation(() => date);
        // create dashboard
        const mc = new MockClient(users);
        const {wrapper, error, table, details} = getDashboardElements();
        const dash = new Dashboard(table, mc);
        await dash.refreshRecords();
        dash.showActive();
        // Fluttershy should not have a timestamp for visit1
        const visit1Cell = await clickVisitCheckbox(mc, "597e8b3e-7907-4eae-a7da-b1abb25f5579", 1, false, true);
        expect(visit1Cell.querySelector("span").textContent).toBe("2010-10-10");
        expect(dateSpy).toHaveBeenCalledTimes(1);
        // restore mocks
        dateSpy.mockRestore();
    });

    it("updates backend through client on uncheck", async () => {
        // mock window.confirm
        const confirmSpy = jest.spyOn(window, "confirm").mockImplementation(() => true);
        // create dashboard
        const mc = new MockClient(users);
        const {wrapper, error, table, details} = getDashboardElements();
        const dash = new Dashboard(table, mc);
        await dash.refreshRecords();
        dash.showActive();
        // Twilight Sparkle should have a timestamp for visit2
        await clickVisitCheckbox(mc, "95240257-42f9-4ae6-b989-0126f595e547", 2, true, false);
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        // restore mocks
        confirmSpy.mockRestore();
    });

    it("sets homeComplete to true when visit5 is checked off", async () => {
        // create dashboard
        const mc = new MockClient(users);
        const {_, __, table, ___} = getDashboardElements();
        const dash = new Dashboard(table, mc);
        await dash.refreshRecords();
        dash.showActive();
        // rainbow dash should not have visit5/homeComplete set
        const rdId = "de7e842d-da61-4756-b120-61eca3e6ab11";
        expect(mc.users.get(rdId).homeComplete).toBeFalsy();
        await clickVisitCheckbox(mc, rdId, 5, false, true);
        expect(mc.users.get(rdId).homeComplete).toBe(true);
    });

    it("sets homeComplete to false when visit5 is unchecked", async () => {
        // mock window.confirm
        const confirmSpy = jest.spyOn(window, "confirm").mockImplementation(() => true);
        // create dashboard
        const mc = new MockClient(users);
        const {_, __, table, ___} = getDashboardElements();
        const dash = new Dashboard(table, mc);
        await dash.refreshRecords();
        dash.showActive();
        // applejack should have visit5/homeComplete set
        const ajId = "1d84a646-db05-4093-8be5-41d1de595a6b";
        expect(mc.users.get(ajId).homeComplete).toBe(true);
        await clickVisitCheckbox(mc, ajId, 5, true, false);
        expect(mc.users.get(ajId).homeComplete).toBe(false);
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        // restore mocks
        confirmSpy.mockRestore();
    });

    async function clickVisitCheckbox(mockClient, userId, visitNum, expectedPreClickState, expectedPostClickState) {
        const userRow = document.querySelector(`[data-user-id="${userId}"]`);
        const [_, __, visit1Cell, visit2Cell, ___, visit3Cell, visit4Cell, visit5Cell, ...____] = userRow.querySelectorAll("td");
        const visitCells = [visit1Cell, visit2Cell, visit3Cell, visit4Cell, visit5Cell];
        const whichVisit = `visit${visitNum}`;
        const whichVisitCell = visitCells[visitNum - 1];
        if (expectedPreClickState) {
            expect(mockClient.users.get(userId).progress).toBeTruthy();
            expect(mockClient.users.get(userId).progress[whichVisit]).toBeTruthy();
            expect(whichVisitCell.querySelector("span").textContent).toBeTruthy();
        } else {
            if (mockClient.users.get(userId).progress) {
                expect(mockClient.users.get(userId).progress[whichVisit]).toBeFalsy();
            }
            expect(whichVisitCell.querySelector("span").textContent).toBeFalsy();
        }
        const input = whichVisitCell.querySelector("input");
        expect(input.checked).toBe(expectedPreClickState);
        input.dispatchEvent(new MouseEvent("click", {bubbles: true}));
        await new Promise(process.nextTick);
        if (expectedPostClickState) {
            expect(mockClient.users.get(userId).progress[whichVisit]).toBeTruthy();
            expect(whichVisitCell.querySelector("span").textContent).toBeTruthy();
        } else {
            expect(mockClient.users.get(userId).progress[whichVisit]).toBeFalsy();
            expect(whichVisitCell.querySelector("span").textContent).toBeFalsy();
        }
        
        expect(input.checked).toBe(expectedPostClickState);

        return whichVisitCell;
    }
});
