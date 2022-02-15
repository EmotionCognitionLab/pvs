import awsSettings from '../../../common/aws-settings.json';

export default class ApiClient {
    constructor(session) {
        this.idToken = session.getIdToken().getJwtToken();
    }

    async getSetsForUser(userId) {
        const url = `${awsSettings.AdminApiUrl}/participant/${userId}/sets`;
        return await this.doFetch(url, "get", null, "There was an error retrieving the sets for the user");
    }

    /**
     * Updates an existing user record.
     * @param {string} userId The id of the user whose record is to be updated
     * @param {object} updates An object with the fields you want to update and the values you want to set them to
     * @returns {object} DynamoDb.DocumentClient.update response. (https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#update-property)
     */
    async updateUser(userId, updates) {
        const url = `${awsSettings.AdminApiUrl}/participant/${userId}`;
        return await this.doFetch(url, "put", updates, `There was an error updating user ${userId}`);
    }

    async doFetch(url, method, body = null, errPreamble = "There was an error fetching the information") {
        const init = {
            method: method,
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Content-type": "application/json",
                "Authorization": this.idToken,
            },
        };
        if (body) init.body = JSON.stringify(body);

        const response = await fetch(url, init);

        if (!response.ok) {
            const respText = await response.text();
            throw new Error(`${errPreamble}: ${respText} (status code: ${response.status})`);
        }
        return await response.json();
    }
}

