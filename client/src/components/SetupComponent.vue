<template>
    <div class="wrapper">
        <div class="instruction" v-if="step==1">
            Welcome! This app will guide you through your heart rate biofeedback sessions.
            The first step is to log in, using the same email address and password that you registered
            with when you signed up for the study.
            <br/>
            <button @click="login">Continue</button>
        </div>
        <div class="instruction" v-else-if="step==2">
            <ConditionAssignmentComponent @complete="nextStep" />
        </div>
        <div v-else-if="step==3">
            <div class="instruction">
            Thank you. Next, we would like to get baseline measurements of your heart rate for five minutes while you rest.
            Please clip your pulse measurement device onto your earlobe and insert the other end into the computer.
            Click "Start" when you're ready to begin.
            </div>
           <TimerComponent :secondsDuration=300 :showButtons=false :running=false @timerFinished="timerFinished" ref="timer" />
           <EmWaveListener :showIbi=false @pulseSensorCalibrated="startTimer" @pulseSensorStopped="stopTimer" ref="timerEmwave" />
        </div>
        <div v-else-if="step=4">
            <div class="instruction">
            We have one remaining task for you with this app today.
            We now will ask you to pace your breathing following the ball you will see on the screen.
            Please breathe in while the ball is moving up and breathe out while the ball is moving down.
            Please make sure you have the pulse device attached to your ear, and click "Start" when you're ready to begin.
            </div>
            <PacerComponent :msPerBreath=4000 :totalMs=210000 :holdMs=0 @pacerFinished="pacerFinished" ref="pacer" />
            <EmWaveListener :showIbi=false @pulseSensorCalibrated="startPacer" ref="pacerEmwave"/>
        </div>
    </div>
</template>

<script setup>
    import { ref } from '@vue/runtime-core';
    import { ipcRenderer } from 'electron'
    import ConditionAssignmentComponent from './ConditionAssignmentComponent.vue'
    import TimerComponent from './TimerComponent.vue'
    import EmWaveListener from './EmWaveListener.vue'
    import PacerComponent from './PacerComponent.vue'

    let step = ref(1)
    const timer = ref(null)
    const timerEmwave = ref(null)
    const pacer = ref(null)
    const pacerEmwave = ref(null)

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

    function timerFinished() {
        timerEmwave.value.stopSensor = true
        nextStep()
    }

    function pacerFinished() {
        pacerEmwave.value.stopSensor = true
    }

    function startPacer() {
        pacer.value.running = true
    }

    ipcRenderer.on('login-succeeded', () => {
        nextStep()
    })
</script>
<style scoped>
    .instruction {
    max-width: 40em;
    padding: 2.5%;
    margin: auto;
    }
    .wrapper {
    display: flex;
    margin: auto;
    flex: 1 1 100%;
    width: 100%;
    justify-content: center;
    }
</style>
