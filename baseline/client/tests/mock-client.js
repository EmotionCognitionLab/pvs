export class MockClient {
    constructor(users = []) {
        this.users = new Map();
        for (const u of users) {
            this.users.set(u.userId, u);
        }
    }

    async getSetsForUser(userId) {
        throw new Error("mock client does not support getSetsForUser");
    }

    async getSelf() {
        throw new Error("mock client does not support self");
    }

    async getUser(userId, consistentRead = false) {
        return this.users.get(userId);
    }

    async updateSelf(updates) {
        throw new Error("mock client does not support self");
    }

    async updateUser(userId, updates) {
        Object.assign(this.users.get(userId), updates);
        return {msg: "update successful"};
    }

    async getResultsForExperiment(experimentName) {
        throw new Error("mock client does not support getting experiment results");
    }

    async getUserStatus(userId, humanId, preComplete, stage2Completed, stage2CompletedOn, homeComplete, postComplete) {
        return this.users.get(userId).status;
    }

    async getAllParticipants() {
        return Array.from(this.users.values()).filter(u => !u.isStaff);
    }

    async doFetch(url, method, errPreamble, body = null) {
        throw new Error("mock client does not support requests");
    }
}

