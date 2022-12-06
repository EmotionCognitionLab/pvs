import payboardTempl from "./payboard.handlebars";
import { earningsTypes } from "../types/types.js";

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
            let earnings;
            if (this.admin) {
                user = await this.client.getUser(this.userId, true);
                earnings = await this.client.getEarningsForUser(this.userId);
            } else {
                user = await this.client.getSelf();
                earnings = await this.client.getEarningsForSelf();
            }
            const data = {};
            data.admin = this.admin;

            const earningsForType = (earningType) => {
                const earned = earnings.filter(e => e.type === earningType);
                if (earned.length === 0) return '';
                // for some types we return the sum of the earnings
                if ([
                        earningsTypes.LUMOS_AND_BREATH_1,
                        earningsTypes.BREATH2, earningsTypes.LUMOS_BONUS,
                        earningsTypes.BREATH_BONUS
                    ].includes(earningType)) {
                        return earned.reduce((prev, cur) => prev + cur.amount, 0);
                } else {
                    if (earned.length > 1) throw new Error(`Expected only one earnings result of type ${earningType} for user ${this.userId}, but found ${earned.length}.`);
                    return earned[0].amount;
                }
            }

            const visitStatus = (whichVisit, visitDate, dropDate) => {
                if (!visitDate) return {status: "Not Started", earned: ''};
                if ((visitDate && !dropDate) || (visitDate < dropDate)) {
                    const earned = earningsForType(whichVisit);
                    return {status: "Completed", earned: earned};
                }
                return {status: "Dropped out", earned: ''}
            }            

            data.visit1 = visitStatus("visit1", user.progress?.visit1, user.progress?.dropped);
            data.visit2 = visitStatus("visit2", user.progress?.visit2, user.progress?.dropped);
            data.visit3 = visitStatus("visit3", user.progress?.visit3, user.progress?.dropped);
            data.visit4 = visitStatus("visit4", user.progress?.visit4, user.progress?.dropped);
            data.visit5 = visitStatus("visit5", user.progress?.visit5, user.progress?.dropped);
            data.week1Status = user.preComplete? 'Completed' : 'In Progress';
            data.week1Earned = earningsForType(earningsTypes.PRE);
            data.week12Status = user.postComplete ? 'Completed' : '';
            data.week12Earned = earningsForType(earningsTypes.POST);
            data.lumosityEarned = earningsForType(earningsTypes.LUMOS_AND_BREATH_1);
            data.breathingEarned = earningsForType(earningsTypes.BREATH2);
            const lumosBonus = earningsForType(earningsTypes.LUMOS_BONUS);
            const breathBonus = earningsForType(earningsTypes.BREATH_BONUS);
            data.bonusEarned = lumosBonus + breathBonus;
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
