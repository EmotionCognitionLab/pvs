import payboardTempl from "./payboard.handlebars";
import { earningsTypes } from "../types/types.js";

export class Payboard {
    constructor(rootDiv, errorDiv, client, user, admin = false) {
        this.rootDiv = rootDiv;
        this.errorDiv = errorDiv;
        this.client = client;
        this.user = user;
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
                        const progress = this.user.progress ?? {};
                        if (!progress['payments']) progress['payments'] = [];
                        if (progress['payments'][i]?.status !== value) {
                            progress['payments'][i] = {
                                status: value,
                                timestamp: (new Date()).toISOString(),
                            };
                            await this.client.updateUser(this.user.userId, {progress});
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
            let earnings;
            if (this.admin) {
                earnings = await this.client.getEarningsForUser(this.user.userId);
            } else {
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
                    if (earned.length > 1) throw new Error(`Expected only one earnings result of type ${earningType} for user ${this.user.userId}, but found ${earned.length}.`);
                    return earned[0].amount;
                }
            }     

            data.visit1Earned = earningsForType("visit1");
            data.visit2Earned = earningsForType("visit2");
            data.visit3Earned = earningsForType("visit3");
            data.visit4Earned = earningsForType("visit4");
            data.visit5Earned = earningsForType("visit5");
            data.week1Earned = earningsForType(earningsTypes.PRE);
            data.week12Earned = earningsForType(earningsTypes.POST);
            data.lumosityEarned = earningsForType(earningsTypes.LUMOS_AND_BREATH_1);
            data.breathingEarned = earningsForType(earningsTypes.BREATH2);
            const lumosBonus = earningsForType(earningsTypes.LUMOS_BONUS);
            const breathBonus = earningsForType(earningsTypes.BREATH_BONUS);
            data.bonusEarned = lumosBonus + breathBonus;

            if (this.user.progress?.payments) {
                if (this.user.progress.payments[0]?.status === 'processed') data['pay1-processed'] = true;
                if (this.user.progress.payments[1]?.status === 'processed') data['pay2-processed'] = true;
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
