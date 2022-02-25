import awsSettings from '../../../common/aws-settings.json';

export default class ApiClient {
    constructor(session) {
        this.idToken = session.getIdToken().getJwtToken();
    }

    async getSetsForUser(userId) {
        const url = `${awsSettings.AdminApiUrl}/participant/${userId}/sets`;
        return await this.doFetch(url, "get", "There was an error retrieving the sets for the user");
    }

    /**
     * Fetches a user record.
     * @param {string} userId The id of the user whose record is to be fetched.
     * @param {boolean} consistentRead Should the fetch use a consistent read?
     * @returns {object} A user record
     */
    async getUser(userId, consistentRead = false) {
        let url =  `${awsSettings.AdminApiUrl}/participant/${userId}`;
        if (consistentRead) {
            url += "?consistentRead=true";
        }
        return await this.doFetch(url, "get", "There was an error retrieving the user data");
    }

    /**
     * Updates an existing user record.
     * @param {string} userId The id of the user whose record is to be updated
     * @param {object} updates An object with the fields you want to update and the values you want to set them to
     * @returns {object} DynamoDb.DocumentClient.update response. (https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html#update-property)
     */
    async updateUser(userId, updates) {
        const url = `${awsSettings.AdminApiUrl}/participant/${userId}`;
        return await this.doFetch(url, "put", `There was an error updating user ${userId}`, updates);
    }

    /**
     * 
     * @param {string} experimentName The name of the experiment whose results you want.
     * @returns Object with either 'url' or 'empty' field.
     * If 'empty' is true, there were no results for the given experiment. If 'url' exists,
     * it is set to the url of a file to be downloaded that contains the results (in JSON format).
     */
     async getResultsForExperiment(experimentName) {
        const url = `${awsSettings.AdminApiUrl}/experiment/${experimentName}`;
        return await this.doFetch(url, "get", `There was an error fetching results for the ${experimentName} experiment`);
    }

    /**
     * 
     * @returns All non-staff (isStaff=false or does not exist) participants in the database
     */
    async getAllParticipants() {

        const url = `${awsSettings.AdminApiUrl}/participants`;
        return await this.doFetch(url, "get", "There was an error fetching particiapnts");
    }

    async doFetch(url, method, errPreamble, body = null) {
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

