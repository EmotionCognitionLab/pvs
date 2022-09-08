<template>
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
</template>
<script setup>
import { ipcRenderer } from 'electron'
import { ref, onBeforeMount } from '@vue/runtime-core'
import LumosityComponent from './LumosityComponent.vue'
import RestComponent from './RestComponent.vue'
import UploadComponent from './UploadComponent.vue'
import { useLumosityHelper, completedLumosity } from '../lumosity-helper.js'
import { yyyymmddNumber } from '../utils.js'

const restBreathingDone = ref(false)
const { lumosDays, lumosityDone, lumosDataReady } = useLumosityHelper()

onBeforeMount(async() => {
    const restBreathingDays = await ipcRenderer.invoke('get-rest-breathing-days')
    const todayYYMMDD = yyyymmddNumber(new Date())
    restBreathingDone.value = restBreathingDays.has(todayYYMMDD)
})

function quit() {
    ipcRenderer.invoke('quit')
}

async function finishedLumosity() {
    await completedLumosity(lumosDays.value)
    lumosityDone.value = true
}

</script>