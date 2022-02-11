import awsSettings from '../../../common/aws-settings.json';

export default class ApiClient {
    constructor(session) {
        this.idToken = session.getIdToken().getJwtToken();
    }

    async getSetsForUser(userId) {
        const url = `${awsSettings.AdminApiUrl}/participant/${userId}/sets`;
        return await this.doFetch(url, "get", "There was an error retrieving the sets for the user");
    }

    async doFetch(url, method, errPreamble = "There was an error fetching the information") {
        const response = await fetch(url, {
            method: method,
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-type": "application/json",
                "Authorization": this.idToken,
            },
        });
        if (!response.ok) {
            const respText = await response.text();
            throw new Error(`${errPreamble}: ${respText} (status code: ${response.status})`);
        }
        return await response.json();
    }
}

