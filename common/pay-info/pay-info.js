import payboardTempl from "./payboard.handlebars";

export class Payboard {
    constructor(rootDiv, errorDiv, client, userId, admin = false) {
        this.rootDiv = rootDiv;
        this.errorDiv = errorDiv;
        this.client = client;
        this.userId = userId;
        this.admin = admin;
    }

    async init() {
        await this.refresh();
        // set class of root div
        this.rootDiv.classList.add("pay-info");

        // add set pay status listener if admin
        if (this.admin) {
            const selects = this.rootDiv.querySelectorAll('select');
            for (let i=0; i<selects.length; i++) {
                const selectElem = selects[i];
                selectElem.addEventListener("change", async event => {
                    const value = event.target.value;
                    try {
                        const progress = (await this.client.getUser(this.userId, true)).progress ?? {};
                        if (!progress['payments']) progress['payments'] = [];
                        if (progress['payments'][i]?.status !== value) {
                            progress['payments'][i] = {
                                status: value,
                                timestamp: (new Date()).toISOString(),
                            };
                            await this.client.updateUser(this.userId, {progress});
                        }
                    } catch (err) {
                        this.handleError(err);
                    }
                });
            }
        }
    }

    async refresh() {
        try {
            // get data
            let user;
            if (this.admin) {
                user = await this.client.getUser(this.userId, true);
            } else {
                user = await this.client.getSelf();
            }
            const data = {};
            data.admin = this.admin;
            const visitStatus = (visitDate, dropDate) => {
                if (!visitDate) return {status: "Not Started", earned: ''};
                if ((visitDate && !dropDate) || (visitDate < dropDate)) return {status: "Completed", earned: "$50"};
                return {status: "Dropped out", earned: ''}
            }            

            data.visit1 = visitStatus(user.progress?.visit1, user.progress?.dropped);
            data.visit2 = visitStatus(user.progress?.visit2, user.progress?.dropped);
            data.visit3 = visitStatus(user.progress?.visit3, user.progress?.dropped);
            data.visit4 = visitStatus(user.progress?.visit4, user.progress?.dropped);
            data.visit5 = visitStatus(user.progress?.visit5, user.progress?.dropped);
            data.week1Status = user.preComplete? 'Completed' : 'In Progress';
            data.week1Earned = user.preComplete? '$30' : '';
            data.week12Status = user.postComplete ? 'Completed' : '';
            data.week12Status = user.postComplete ? '$30' : '';
            if (user.homeComplete) {
                data.lumosityStatus = 'Completed';
                data.breathingStatus = 'Completed';
            }

            if (user.progress?.payments) {
                if (user.progress.payments[0]?.status === 'processed') data['pay1-processed'] = true;
                if (user.progress.payments[1]?.status === 'processed') data['pay2-processed'] = true;
            }

            this.rootDiv.innerHTML = payboardTempl(data);
        } catch (err) {
            this.handleError(err);
        }
    }

    handleError(err) {
        console.error(`error: ${err}`);
        this.errorDiv.textContent = `error: ${err.message ?? err}`;
    }
}
