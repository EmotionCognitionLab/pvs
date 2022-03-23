export class Payboard {
    constructor(div, client, admin = false) {
        this.elements = {root: div};
        this.client = client;
        this.progress = null;
        this.finishedSessionsCount = null;
        this.initializeElements();
    }

    initializeElements() {
    }

    async refresh() {
    }

    show() {
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
