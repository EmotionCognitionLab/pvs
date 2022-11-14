<template>
    <div>
        <h2>Days you did everything</h2>
        <img v-bind:src="require('../assets/sess5.png')" :class="{gray: numCompleteDays < 5}">
        <img v-bind:src="require('../assets/sess10.png')" :class="{gray: numCompleteDays < 10}">
        <img v-bind:src="require('../assets/sess20.png')" :class="{gray: numCompleteDays < 20}">
        <img v-bind:src="require('../assets/sess40.png')" :class="{gray: numCompleteDays < 40}">
        <img v-bind:src="require('../assets/sess60.png')" :class="{gray: numCompleteDays < 60}">
        <br>
        <h2>Streak</h2>
        <img v-bind:src="require('../assets/streak3.png')" :class="{gray: streakDur < 3}">
        <img v-bind:src="require('../assets/streak10.png')" :class="{gray: streakDur < 10}">
        <img v-bind:src="require('../assets/streak15.png')" :class="{gray: streakDur < 15}">
        <img v-bind:src="require('../assets/streak30.png')" :class="{gray: streakDur < 30}">
        <img v-bind:src="require('../assets/streak60.png')" :class="{gray: streakDur < 60}">
    </div>
</template>
<script setup>
import { ref, onBeforeMount } from '@vue/runtime-core'
import { yyyymmddString } from '../utils.js';

const streakDur = ref(null)
const numCompleteDays = ref(null)

onBeforeMount(async() => {
    const startDate = new Date(1970, 0, 1)
    const restSegments = await window.mainAPI.getSegmentsAfterDate(startDate, 2)
    const pacedBreathingSegments = await window.mainAPI.getSegmentsAfterDate(startDate, 3)
    const restByDate = segmentCountByDay(restSegments)
    const pacedByDate = segmentCountByDay(pacedBreathingSegments)
    console.debug('restByDate', restByDate)
    console.debug('pacedByDate', pacedByDate)
    const completeRestDates = Object.keys(restByDate);
    const completePacedDates = Object.entries(pacedByDate).filter(e => e[1] >= 6).map(e => e[0])
    const completeDays = new Set([...completeRestDates, ...completePacedDates])
    numCompleteDays.value = completeDays.size
    streakDur.value = streakLength(completeDays)
})

function segmentCountByDay(segments) {
    const res = new Object()
    segments.forEach(s => {
        const segDate = yyyymmddString(new Date(s.endDateTime * 1000))
        const countForDate = res[segDate] || 0
        res[segDate] = countForDate + 1
    })
    return res
}

function streakLength(allSessionDays) {
    const allDaysSorted = Array.from(allSessionDays).sort((a, b) => {
        if (a < b) return 1;
        if (a > b) return -1;
        return 0;
    })
    const daysBetween = daysBetweenDates(allDaysSorted)
    let res = 0;
    let i = 0;
    while(daysBetween[i++] == 1) {
        res++;
    }
    return res;
}

function daysBetweenDates(dates) {
    const res = [];
    for (let i = 0; i < dates.length - 1; i++) {
        const d1 = yyyymmddStrToDate(dates[i])
        const d2 = yyyymmddStrToDate(dates[i+1])
        res.push((d2 - d1) / (1000 * 60 * 60 * 24))
    }
    return res;
}

function yyyymmddStrToDate(yyyymmdd) {
    const y = yyyymmdd.substring(0, 4);
    const m = yyyymmdd.substring(4, 6);
    const d = yyyymmdd.substring(6, 8);
    return new Date(y, Number.parseInt(m) - 1, d);
}
</script>
<style scoped>
.gray {
    filter: grayscale(1);
}
</style>