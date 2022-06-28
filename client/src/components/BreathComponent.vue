<template>
    <div>
        <div class="instruction" v-if="!sessionDone && !dayDone">
        We have one remaining task for you today.
        Please breathe following the ball on the screen.
        Breathe in while the ball is moving up and breathe out while the ball is moving down.
        Make sure you have the pulse device attached to your ear, and click "Start" when you're ready to begin.
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
            <EmWaveListener :showIbi=false :showScore=true :condition=condition @pulseSensorCalibrated="startPacer" @pulseSensorStopped="stopPacer" @pulseSensorSignalLost="stopPacer" @pulseSensorSignalRestored="resumePacer" ref="emwaveListener"/>
        </div>
    </div>
</template>
<script setup>
import { ipcRenderer } from 'electron'
import { ref, onBeforeMount, computed } from '@vue/runtime-core'
import ApiClient from '../../../common/api/client.js'
import { SessionStore } from '../session-store.js'
import PacerComponent from './PacerComponent.vue'
import EmWaveListener from './EmWaveListener.vue'

const pacer = ref(null)
const emwaveListener = ref(null)
const regimes = ref([])
const sessionDone = ref(false)
const dayDone = computed(() => regimes.value.length === 0)
const condition = ref(null);

async function setRegimes(condition) {
    const sessRegimes = await ipcRenderer.invoke('regimes-for-session', condition)
    regimes.value = sessRegimes
}

onBeforeMount(async() => {
    const session = SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    const data = await apiClient.getSelf()
    condition.value = data.condition.assigned;
    await setRegimes(data.condition.assigned)
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