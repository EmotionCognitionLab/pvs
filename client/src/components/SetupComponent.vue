<template>
    <div class="wrapper">
        <div class="instruction" v-if="step==0">
            One moment while we load your data...
        </div>
        <div class="instruction" v-else-if="step==1">
           <LoginComponent post-login-path="/setup" @loginSucceeded="nextStep">
               <template #bodyText>
                Welcome! This app will guide you through your heart rate biofeedback sessions.
                The first step is to log in, using the same email address and password that you registered
                with when you signed up for the study.<br/>
               </template>
               <template #btnText>Get Started</template>
           </LoginComponent>
        </div>
        <div class="instruction" v-else-if="step==2">
            <ConditionAssignmentComponent @complete="nextStep" />
        </div>
        <div v-else-if="step==3">
            <RestComponent @timerFinished="timerFinished">
                <template #preText>
                    <div class="instruction">
                        Thank you. Next, we would like to get baseline measurements of your heart rate for five minutes while you rest.
                        Please clip your pulse measurement device onto your earlobe and insert the other end into the computer.
                        Click "Start" when you're ready to begin.
                    </div>
                </template>
            </RestComponent>
        </div>
        <div v-else-if="step==4">
            <div class="instruction">
            We have one remaining task for you with this app today.
            We now will ask you to pace your breathing following the ball you will see on the screen.
            Please breathe in while the ball is moving up and breathe out while the ball is moving down.
            Please make sure you have the pulse device attached to your ear, and click "Start" when you're ready to begin.
            </div>
            <PacerComponent 
                :regimes="[{durationMs: 300000, breathsPerMinute: 15, randomize: false}]"
                :scaleH=290
                :scaleT=0.1 
                :offsetProportionX=0.25
                :offsetProportionY=0.8
                @pacerFinished="pacerFinished" ref="pacer" />
            <EmWaveListener :showIbi=false @pulseSensorCalibrated="startPacer" @pulseSensorStopped="stopPacer" @pulseSensorSignalLost="stopPacer" @pulseSensorSignalRestored="resumePacer" ref="pacerEmwave"/>
        </div>
        <div v-else-if="step==5">
            <UploadComponent>
                <template #preUploadText>
                    <div class="instruction">Terrific! Thank you for completing this orientation. Please wait while we upload your data...</div>
                </template>
                <template #postUploadText>
                     <div class="instruction">Upload complete! At home tomorrow, please log in to the app to start your home training.</div>
                    <br/>
                    <button class="button" @click="quit">Quit</button>
                </template>
            </UploadComponent>
        </div>
    </div>
</template>

<script setup>
    import { ipcRenderer } from 'electron'
    import { ref, onBeforeMount } from '@vue/runtime-core';
    import { isAuthenticated } from '../../../common/auth/auth.js'
    import ConditionAssignmentComponent from './ConditionAssignmentComponent.vue'
    import LoginComponent from './LoginComponent.vue'
    import EmWaveListener from './EmWaveListener.vue'
    import PacerComponent from './PacerComponent.vue'
    import UploadComponent from './UploadComponent.vue'
    import RestComponent from './RestComponent.vue'

    // step 0: nothing initialized yet
    // step 1: unauthenticated user
    // step 2: authenticated user who has not been assigned to condition
    // step 3: user has completed assignment to condition
    // step 4: user has completed rest breathing
    // step 5: user has completed paced breathing
    let step = ref(0)
    const pacer = ref(null)
    const pacerEmwave = ref(null)
    
    
    onBeforeMount(async() => {
        if (!isAuthenticated()) {
            step.value = 1
            return
        }
        if (window.localStorage.getItem('HeartBeam.isConfigured') !== 'true') {
            step.value = 2
            return
        }
        const restBreathingDays = await ipcRenderer.invoke('get-rest-breathing-days')
        if (restBreathingDays.size < 1) {
            step.value = 3
            return
        }
        const pacedBreathingDays = await ipcRenderer.invoke('get-paced-breathing-days')
        if (pacedBreathingDays.size < 1) {
            step.value = 4
            return
        }
        step.value = 5
        return
    })

    function nextStep() {
        step.value += 1
    }

    function timerFinished() {
        nextStep()
    }

    function pacerFinished() {
        pacerEmwave.value.stopSensor = true
        nextStep()
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

    function quit() {
        ipcRenderer.invoke('quit')
    }

</script>
<style scoped>
    .wrapper {
    display: flex;
    margin: auto;
    flex: 1 1 100%;
    width: 100%;
    justify-content: center;
    }
</style>
