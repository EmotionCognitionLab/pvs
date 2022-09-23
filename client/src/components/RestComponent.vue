<template>
    <div class="instruction" v-if="!done">
        <slot name="preText">
            When you are ready to rest for 5 minutes while measuring your heart rate, please connect your pulse sensor to your ear and to the computer and press the start button.
        </slot>
        <EmWaveListener :showIbi=false @pulseSensorCalibrated="startTimer" @pulseSensorStopped="sensorStopped" @pulseSensorSignalLost="sensorStopped" @pulseSensorSignalRestored="startTimer" @pulseSensorSessionEnded="resetTimer" ref="emwaveListener"/> 
        <br/>
        <TimerComponent :secondsDuration=300 :showButtons=false @timerFinished="stopSession" ref="timer" />
    </div>
    <div class="instruction" v-else>
        <slot name="postText">
            All done for today! Please come back tomorrow for more training.
            <br/>
            <button class="button"  @click="quit">Quit</button>
        </slot>
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
const emit = defineEmits(['timer-finished'])
let timerDone = false

function startTimer() {
    timer.value.running = true
}

function sensorStopped() {
    if (timerDone) {
        // then we've finished here and this is being called b/c
        // the emwave sensor has been successfully stopped,
        // which means we're totally done here
        emit('timer-finished')
        done.value = true
    }
    timer.value.running = false
}

function resetTimer() {
    timer.value.reset()
}

function stopSession() {
    timerDone = true
    emwaveListener.value.stopSensor = true
}

function quit() {
    ipcRenderer.invoke('quit')
}

</script>
