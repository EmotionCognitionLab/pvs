<template>
    <div>
        <h2>Welcome, {{ userName }}! </h2>
        <h3>Number of days you completed home training</h3>
        <img v-for="(badge, idx) in sessionBadges" :key="idx" :src="'image://' + badge">
        <div>{{lumosBonusMsg}}</div>
        <div>{{breathBonusMsg}}</div>
        <div><button id="continue" class="button" @click="goToTasks">Continue to today's session</button></div>
    </div>
</template>
<script setup>
import { ref, onBeforeMount } from '@vue/runtime-core'
import { useRouter } from "vue-router";
import { yyyymmddString } from '../utils.js';
import ApiClient from '../../../common/api/client.js'
import { earningsTypes } from '../../../common/types/types.js';
import { SessionStore } from '../session-store'

const router = useRouter();
const userName = ref(null)
const sessionBadges = ref([])
const lumosBonusMsg = ref("")
const breathBonusMsg = ref("")

onBeforeMount(async() => {
    const startDate = new Date(1970, 0, 1)
    const restSegments = await window.mainAPI.getSegmentsAfterDate(startDate, 2)
    const pacedBreathingSegments = await window.mainAPI.getSegmentsAfterDate(startDate, 3)
    const restByDate = segmentCountByDay(restSegments)
    const pacedByDate = segmentCountByDay(pacedBreathingSegments)
    const completeRestDates = Object.keys(restByDate);
    const completePacedDates = Object.entries(pacedByDate).filter(e => e[1] >= 6).map(e => e[0])
    const completeDays = new Set([...completeRestDates, ...completePacedDates])
    sessionBadges.value = sessionImages(completeDays.size)
    const sess = await SessionStore.getRendererSession()
    const apiClient = new ApiClient(sess)
    const data = await apiClient.getSelf()
    userName.value = data.name.split(' ')[0]
    const lumosBonusEarnings = await apiClient.getEarningsForSelf(earningsTypes.LUMOS_BONUS)
    const breathBonusEarnings = await apiClient.getEarningsForSelf(earningsTypes.BREATH_BONUS)
    // earnings are returned with latest last, so .slice(-1)[0] gives us most recent
    lumosBonusMsg.value = await lumosBonusAchieved(lumosBonusEarnings.slice(-1)[0])
    breathBonusMsg.value = await breathBonusAchieved(breathBonusEarnings.slice(-1)[0], data.condition.assigned)
})

function sessionImages(numCompleteDays) {
    const baseImgs = ['sess5', 'sess10', 'sess20', 'sess40', 'sess60']
    const grayStr = '-gray'
    const suffix = '.png'

    const grayOut = (img) =>  img + grayStr + suffix
    // lights up all images up to and including idx
    const lightUp = (idx) => {
        return baseImgs.map((b, curIdx) => curIdx <= idx ? b + suffix : grayOut(b))
    }

    if (numCompleteDays < 5) return baseImgs.map(grayOut)
    if (numCompleteDays < 10) return lightUp(0)
    if (numCompleteDays < 20) return lightUp(1)
    if (numCompleteDays < 40) return lightUp(2)
    if (numCompleteDays < 60) return lightUp(3)
    return lightUp(4);

}

function segmentCountByDay(segments) {
    const res = new Object()
    segments.forEach(s => {
        const segDate = yyyymmddString(new Date(s.endDateTime * 1000))
        const countForDate = res[segDate] || 0
        res[segDate] = countForDate + 1
    })
    return res
}

function goToTasks() {
    router.push({path: '/current-stage'})
}

async function lumosBonusAchieved(lastLumosBonusEarnings) {
    if (!lastLumosBonusEarnings) return ""

    const lastBonusDate = Math.round(new Date(lastLumosBonusEarnings.date).getTime() / 1000)
    const lastBonusDisplayedDate = await window.mainAPI.getLastShownDateTimeForBonusType(earningsTypes.LUMOS_BONUS)
    if (lastBonusDate > lastBonusDisplayedDate) {
        await window.mainAPI.setLastShownDateTimeForBonusType(earningsTypes.LUMOS_BONUS, Math.round(Date.now() / 1000))
        return "Congratulations! You've earned a $2 bonus for improving your brain game scores this past week. Keep it up!"
    }

    return ""
}

async function breathBonusAchieved(lastBreathBonusEarnings, condition) {
    if (!lastBreathBonusEarnings) return ""

    const lastBonusDate = new Date(lastBreathBonusEarnings.date).getTime() / 1000
    const lastBonusDisplayedDate = await window.mainAPI.getLastShownDateTimeForBonusType(earningsTypes.BREATH_BONUS)
    if (lastBonusDate > lastBonusDisplayedDate) {
        await window.mainAPI.setLastShownDateTimeForBonusType(earningsTypes.BREATH_BONUS, Math.round(Date.now() / 1000))
        let adjective = ""
        if (condition === 'A') {
            adjective = "relaxed"
        } else {
            adjective = "alert"
        }
        return `Great job! Your heart rate data indicate you were even more ${adjective} than usual during yesterday's breathing practice. You've earned a $1 bonus.`
    }

    return ""
}

</script>
<style scoped>
#continue {
    margin-top: 50px;
}
</style>