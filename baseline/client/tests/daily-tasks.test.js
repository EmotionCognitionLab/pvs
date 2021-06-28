'use strict';

const dailyTasks = require("../daily-tasks/daily-tasks.js");

describe("getSetAndTasks", () => {
    it("returns the set and remaining tasks in the set", () => {
        const input = [{experiment: dailyTasks.allSets[0][0]}, {experiment: dailyTasks.allSets[0][1]}];
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(1);
        expect(result.remainingTasks).toStrictEqual(dailyTasks.allSets[0].slice(input.length));
    });

    it("returns the next set and all tasks in it if all tasks in the previous set have been ccompleted", () => {
        const input = dailyTasks.allSets[0].map(name => { return { experiment: name } });
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(2);
        expect(result.remainingTasks).toStrictEqual(dailyTasks.allSets[result.set - 1]);
    });

    it("throws an error if completed tasks are not in the expected order", () => {
        const input = [{experiment: dailyTasks.allSets[0][0]}, {experiment: dailyTasks.allSets[0][2]}];
        function callWithBadOrder() {
            dailyTasks.getSetAndTasks(input);
        }
        const expectedErrPatt = new RegExp(`^Expected ${dailyTasks.allSets[0][1]} but found ${dailyTasks.allSets[0][2]}.*$`);
        expect(callWithBadOrder).toThrowError(expectedErrPatt);
    });

    it("should return no tasks if all sets and all tasks have been completed", () => {
        const input = [];
        dailyTasks.allSets.forEach(s => {
            s.forEach(task => {
                input.push({experiment: task});
            });
        });
        const result = dailyTasks.getSetAndTasks(input);
        expect(result.set).toBe(dailyTasks.allSets.length);
        expect(result.remainingTasks).toStrictEqual([]);
    });
});
