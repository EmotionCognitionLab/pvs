<template>
    <div>
        <div class="instruction" v-if="!sessionDone && !dayDone">
        We have one remaining task for you with this app today.
        We now will ask you to pace your breathing following the ball you will see on the screen.
        Please breathe in while the ball is moving up and breathe out while the ball is moving down.
        Please make sure you have the pulse device attached to your ear, and click "Start" when you're ready to begin.
        </div>
        <div class="instruction" v-else-if="sessionDone && !dayDone">
        All done! Please come back later today to do your next session.
        <br/>
        <button class="button" @click="sessionDone=false">Start Next Session</button>
        </div>
        <div class="instruction" v-else>
        All done for today! Please come back tomorrow for more training.
        <br/>
        <button class="button"  @click="quit">Quit</button>
        </div>
        <div v-if="!sessionDone && !dayDone && regimes && regimes.length"> <!-- Need regimes && regimes.length here to prevent render before regimes has been initialized -->
            <PacerComponent 
                :regimes="regimes"
                :scaleH=290
                :scaleT=0.1 
                :offsetProportionX=0.25
                :offsetProportionY=0.8
                @pacerFinished="pacerFinished"
                ref="pacer" />
            <EmWaveListener :showIbi=false @pulseSensorCalibrated="startPacer" @pulseSensorStopped="stopPacer" @pulseSensorSignalLost="stopPacer" @pulseSensorSignalRestored="resumePacer" ref="emwaveListener"/>
        </div>
    </div>
</template>
<script setup>
import { ipcRenderer } from 'electron'
import { ref, onBeforeMount, computed } from '@vue/runtime-core'
import PacerComponent from './PacerComponent.vue'
import EmWaveListener from './EmWaveListener.vue'

const pacer = ref(null)
const emwaveListener = ref(null)
const regimes = ref([])
const sessionDone = ref(false)
const dayDone = computed(() => regimes.value.length === 0)

async function setRegimes() {
    // TODO fetch subject condition from db
    const sessRegimes = await ipcRenderer.invoke('regimes-for-session', 'b')
    regimes.value = sessRegimes
}

onBeforeMount(async() => {
    await setRegimes()
})

async function pacerFinished() {
    emwaveListener.value.stopSensor = true
    sessionDone.value = true
    setTimeout(async () => await setRegimes(), 50) // use setTimeout to avoid race condition with the data from last regime being saved
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