<template>
    <div v-if="firstTime" class="instruction">
        In this video, Dr. Mara Mather explains the next phase of the study.
        <br/>
        <iframe width="560" height="315" src="https://www.youtube.com/embed/MAVUImKD36E" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        <br/>
        <button @click="continueToLumosity" class="button">Continue</button>
    </div>
    <div v-else>
        <div v-if="lumosDataReady">
            <div class="instruction-small" v-if="!lumosityDone">
                <LumosityComponent @lumosityFinished="finishedLumosity()"/>
            </div>
            <div class="instruction" v-else-if="lumosityDone && !restBreathingDone">
                <RestComponent @timerFinished="restBreathingDone=true" />
            </div>
            <div v-else-if="lumosityDone && restBreathingDone">
                <UploadComponent>
                    <template #preUploadText>
                        <div class="instruction">Terrific! Please wait while we upload your data...</div>
                    </template>
                    <template #postUploadText>
                            <div class="instruction">Upload complete! Please come back tomorrow for more training.</div>
                        <br/>
                        <button class="button" @click="quit">Quit</button>
                    </template>
                </UploadComponent>
            </div>
        </div>
        <div class="instruction" v-else>
            One moment while we load your data...
        </div>
    </div>
</template>
<script setup>
import { ref, onBeforeMount } from '@vue/runtime-core'
import LumosityComponent from './LumosityComponent.vue'
import RestComponent from './RestComponent.vue'
import UploadComponent from './UploadComponent.vue'
import { useLumosityHelper, completedLumosity } from '../lumosity-helper.js'
import { yyyymmddNumber } from '../utils.js'

const restBreathingDone = ref(false)
const lumosDays = ref(null)
const lumosityDone = ref(null)
const lumosDataReady = ref(null)
const firstTime = ref(window.localStorage.getItem('HeartBeam.hasSeenStage2Vid') !== 'true')

onBeforeMount(async() => {
     const { days, done, ready } = await useLumosityHelper()
    lumosDays.value = days
    lumosityDone.value = done
    lumosDataReady.value = ready
    window.mainAPI.setStage(2)
    const restBreathingDays = await window.mainAPI.getRestBreathingDays(2)
    const todayYYMMDD = yyyymmddNumber(new Date())
    restBreathingDone.value = restBreathingDays.has(todayYYMMDD)
})

function continueToLumosity() {
    window.localStorage.setItem('HeartBeam.hasSeenStage2Vid', 'true')
    firstTime.value = false
}

function quit() {
    window.mainAPI.quit()
}

async function finishedLumosity() {
    await completedLumosity(lumosDays.value)
    lumosityDone.value = true
}

</script>