<template>
    <div>

        <div v-if="step==1">
            Welcome! This app will guide you through your heart rate biofeedback sessions.
            The first step is to log in, using the same email address and password that you registered
            with when you signed up for the study.
            <br/>
            <button @click="login">Continue</button>
        </div>
        <div v-else-if="step==2">
            <ConditionAssignmentComponent @complete="nextStep" />
        </div>
        <div v-else-if="step==3">
            Thank you. Next, we would like to get baseline measurements of your heart rate for five minutes while you rest.
            Please clip your pulse measurement device onto your earlobe and insert the other end into the computer.
            Click "Start" when you're ready to begin.
            <br/>
           <TimerComponent :secondsDuration=300 :showButtons=false :running=false ref="timer" />
           <EmWaveListener :showIbi=false @pulseSensorCalibrated="startTimer" @pulseSensorStopped="stopTimer" />
        </div>
    </div>
</template>

<script setup>
    import { ref } from '@vue/runtime-core';
    import { ipcRenderer } from 'electron'
    import ConditionAssignmentComponent from './ConditionAssignmentComponent.vue'
    import TimerComponent from './TimerComponent.vue'
    import EmWaveListener from './EmWaveListener.vue'

    let step = ref(1)
    const timer = ref(null)

    function login() {
        ipcRenderer.send('show-login-window')
    }
    
    function nextStep() {
        step.value += 1
    }

    function startTimer() {
        timer.value.running = true
    }

    function stopTimer() {
        timer.value.running = false
    }

    ipcRenderer.on('login-succeeded', () => {
        nextStep()
    })
</script>
