<template>
    <div v-if="lumosDataReady">
        <div class="instruction" v-if="!lumosityDone">
            <LumosityComponent @lumosityFinished="finishedLumosity()"/>
        </div>
        <div class="instruction" v-else-if="!sessionDone && !dayDone && regimes && regimes.length">  <!-- Need regimes && regimes.length here to prevent render before regimes has been initialized -->
            We have one remaining task for you today.
            Please breathe following the ball on the screen.
            Breathe in while the ball is moving up and breathe out while the ball is moving down.
            Make sure you have the pulse device attached to your ear, and click "Start" when you're ready to begin.
            <PacerComponent 
                :regimes="regimes"
                :scaleH=290
                :scaleT=0.1 
                :offsetProportionX=0.25
                :offsetProportionY=0.8
                @pacerFinished="pacerFinished"
                ref="pacer" />
            <EmWaveListener :showIbi=false :showScore=true :condition=condition @pulseSensorCalibrated="startPacer" @pulseSensorStopped="stopPacer" @pulseSensorSignalLost="stopPacer" @pulseSensorSignalRestored="resumePacer" ref="emwaveListener"/>
        </div>
        <div class="instruction" v-else-if="sessionDone && !dayDone">
            All done! Please come back later today to do your next session.
            <br/>
            <button class="button" @click="sessionDone=false">Start Next Session</button>
        </div>
        <div class="instruction" v-else-if="sessionDone && dayDone">
            <UploadComponent>
                <template #preUploadText>
                    <div class="instruction">Terrific! Please wait while we upload your data...</div>
                </template>
                <template #postUploadText>
                        <div class="instruction">Upload complete. You're all done for today! Please come back tomorrow for more training.</div>
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
import { ref, onBeforeMount, computed } from '@vue/runtime-core'
import PacerComponent from './PacerComponent.vue'
import UploadComponent from './UploadComponent.vue'
import EmWaveListener from './EmWaveListener.vue'
import LumosityComponent from './LumosityComponent.vue'
import { useLumosityHelper, completedLumosity } from '../lumosity-helper.js'

const pacer = ref(null)
const emwaveListener = ref(null)
const regimes = ref([])
const sessionDone = ref(false)
const dayDone = computed(() => regimes.value.length === 0)
const condition = ref("B");
const { lumosDays, lumosityDone, lumosDataReady } = useLumosityHelper()

async function setRegimes(condition) {
    const sessRegimes = await ipcRenderer.invoke('regimes-for-session', condition)
    regimes.value = sessRegimes
}

onBeforeMount(async() => {
	await setRegimes(condition.value)
})

async function pacerFinished() {
    emwaveListener.value.stopSensor = true
    sessionDone.value = true
    setTimeout(async () => await setRegimes(), 50) // use setTimeout to avoid race condition with the data from last regime being saved
}

async function finishedLumosity() {
    await completedLumosity(lumosDays.value)
    lumosityDone.value = true
}

function quit() {
    ipcRenderer.invoke('quit')
}

function startPacer() {
    if (pacer) pacer.value.start = true
}

function stopPacer() {
    pacer.value.pause = true
}

function resumePacer() {
    pacer.value.resume = true
}

</script>
<style scope>
 .button {
        padding: 8px;
        font-size: 18px;
        font-weight: bold;
        margin-right: 4px;
        margin-top: 5px;
    }
</style>