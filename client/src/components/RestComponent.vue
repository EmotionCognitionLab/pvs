<template>
    <div class="instruction" v-if="!done">
        When you are ready to rest for 5 minutes while measuring your heart rate, please connect your pulse sensor to your ear and to the computer and press the start button.
        <EmWaveListener :showIbi=false @pulseSensorCalibrated="startTimer" @pulseSensorStopped="stopTimer" @pulseSensorSignalLost="stopTimer" @pulseSensorSignalRestored="startTimer" ref="emwaveListener"/> 
        <br/>
        <TimerComponent :secondsDuration=300 :showButtons=false @timerFinished="stopSession" ref="timer" />
    </div>
    <div class="instruction" v-else>
        All done for today! Please come back tomorrow for more training.
        <br/>
        <button class="button"  @click="quit">Quit</button>
    </div>
</template>
<script setup>
import { ipcRenderer } from 'electron'
import { ref } from '@vue/runtime-core'
import EmWaveListener from './EmWaveListener.vue'
import TimerComponent from './TimerComponent.vue'

const emwaveListener = ref(null)
const timer = ref(null)
const done = ref(false)

function startTimer() {
    timer.value.running = true
}

function stopTimer() {
    timer.value.running = true
}

function stopSession() {
    emwaveListener.value.stopSensor = true
    done.value = true
}

function quit() {
    ipcRenderer.invoke('quit')
}

</script>
