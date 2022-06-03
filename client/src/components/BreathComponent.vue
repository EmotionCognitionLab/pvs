<template>
    <div>
        <div class="instruction">
        We have one remaining task for you with this app today.
        We now will ask you to pace your breathing following the ball you will see on the screen.
        Please breathe in while the ball is moving up and breathe out while the ball is moving down.
        Please make sure you have the pulse device attached to your ear, and click "Start" when you're ready to begin.
        </div>
        <PacerComponent v-if="regimes && regimes.length"
            :regimes="regimes"
            :scaleH=290
            :scaleT=0.1 
            :offsetProportionX=0.25
            :offsetProportionY=0.8
            @pacerFinished="pacerFinished"
            ref="pacer" />
        <EmWaveListener :showIbi=false @pulseSensorCalibrated="startPacer" @pulseSensorStopped="stopPacer" @pulseSensorSignalLost="stopPacer" @pulseSensorSignalRestored="resumePacer" ref="emwaveListener"/>
    </div>
</template>
<script setup>
import { ipcRenderer } from 'electron'
import { ref, onBeforeMount } from '@vue/runtime-core'
import PacerComponent from './PacerComponent.vue'
import EmWaveListener from './EmWaveListener.vue'

const pacer = ref(null)
const emwaveListener = ref(null)
const regimes = ref([])

onBeforeMount(async() => {
    // TODO fetch subject condition from db
    const sessRegimes = await ipcRenderer.invoke('regimes-for-session', 'b')
    regimes.value = sessRegimes
})

function pacerFinished() {
    emwaveListener.value.stopSensor = true
}

function startPacer() {
    pacer.value.start = true
}

function stopPacer() {
    pacer.value.pause = true
}

function resumePacer() {
    pacer.value.resume = true
}

</script>