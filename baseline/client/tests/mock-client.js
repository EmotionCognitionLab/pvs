export class MockClient {
    constructor(users = [], results = []) {
        this.users = new Map();
        for (const u of users) {
            this.users.set(u.userId, u);
        }
        this.results = new Map();
        for (const r of results) {
            this.results.set(r.experimentDateTime, r);
        }
    }

    async getSetsForUser(userId) {
        return Array.from(this.results.values())
            .filter(r => r.userId === userId)
            .map(r => ({
                identityId: r.identityId,
                ...experimentDateTimeToExperimentAndDateTime(r.experimentDateTime),
            }))
            .sort((r1, r2) => {
                if (r1.dateTime < r2.dateTime) {
                    return -1
                }
                if (r1.dateTime > r2.dateTime) {
                    return 1;
                }
                return 0;
            });
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

    async getAllParticipants() {
        return Array.from(this.users.values()).filter(u => !u.isStaff);
    }

    async doFetch(url, method, errPreamble, body = null) {
        throw new Error("mock client does not support requests");
    }
}

function experimentDateTimeToExperimentAndDateTime(experimentDateTime) {
    const parts = experimentDateTime.split("|");
    if (parts.length != 3) {
        throw new Error(`Unexpected experimentDateTime value: ${experimentDateTime}. Expected three parts, but found ${parts.length}.`)
    }
    const experiment = parts[0];
    const dateTime = parts[1];
    return {experiment, dateTime};
}
