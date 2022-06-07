<template>
    <div>
        <div v-if="!calibrated && running && !sensorError">
            Waiting for pulse signal..
        </div>
        <div v-if="sensorError">
            No or poor signal detected. Please make sure the device is connected properly and your earlobe is warm.
            (If it is cold, try rubbing it between your thumb and forefinger to warm it up and get blood flowing to it.)
        </div>
        <div v-if="sessionEnded">
            The session has ended because it has been a long time since the device detected a pulse signal.
            Please press the start button when you are ready to start over.
        </div>
        <button class="pulse-sensor-button" id="startSensor" :disabled="running" @click="startPulseSensor">Start</button>
        <div v-if="showIbi" id="ibi">{{ ibi }}</div>
    </div>
   
</template>
<script setup>
    import { ipcRenderer } from 'electron'
    import { ref, watch } from '@vue/runtime-core'

    defineProps(['showIbi'])
    const emit = defineEmits(['pulse-sensor-calibrated', 'pulse-sensor-signal-lost', 'pulse-sensor-signal-restored', 'pulse-sensor-stopped'])
    let ibi = ref(0)
    let calibrated = ref(false)
    let running = ref(false)
    let sensorError = ref(false) // set to true if we fail to get a signal at session start or if we get too many signal artifacts
    let sessionEnded = ref(false) // set to true if emwave ends the session, usually due to prolonged signal loss
    let signalLossInterval = null
    let forcedRestartInterval = null
    let stopSensor = ref(false)
    defineExpose({stopSensor})

    // per Mara, if we go a full minute without signal we should force the user to restart the session
    // If we go 10s without signal we should tell them to mess with their sensor/earlobe.
    const signalLossTimeout = () => !calibrated.value ? 30000 : 10000 // allows longer time for signal acquisition at start of session
    const forcedRestartTimeout = () => 60000 - signalLossTimeout() // this timer doesn't start until after the signal loss timer has fired

    watch(running, (isRunning) => {
        if (isRunning) {
            startSignalLossTimer()
        } else {
            stopSignalLossTimer()
        }
    })

    watch(stopSensor, (shouldStopSensor) => {
        if (shouldStopSensor) {
            stopPulseSensor()
        }
    })

    ipcRenderer.on('emwave-ibi', (event, hrData) => {
        ibi.value = Number(hrData.ibi)
        if (ibi.value <= 0) return

        if (!calibrated.value) {
            calibrated.value = true
            emit('pulse-sensor-calibrated')
        }
        if (sensorError.value) {
            emit('pulse-sensor-signal-restored')
        }
        resetSignalLossTimer()
        resetForcedRestartTimer()
    })

    ipcRenderer.on('emwave-status', (event, message) => {
        if (message === 'SensorError') {
            stopPulseSensor()
            sensorError.value = true
        } else if (message === 'SessionEnded') {
            emit('pulse-sensor-stopped')
            running.value = false
            calibrated.value = false
            sessionEnded.value = true
        }
    })

    // eslint-disable-next-line no-unused-vars
    function startPulseSensor() {
        ipcRenderer.send('pulse-start')
        running.value = true
        stopSensor.value = false
        sessionEnded.value = false
    }
    
    // eslint-disable-next-line no-unused-vars
    function stopPulseSensor() {
        ipcRenderer.send('pulse-stop')
        emit('pulse-sensor-stopped')
        running.value = false
        calibrated.value = false
    }

    function startSignalLossTimer() {
        signalLossInterval = setTimeout(
            () => { 
                sensorError.value = true
                emit('pulse-sensor-signal-lost')
                startForcedRestartTimer()
            }, 
            signalLossTimeout()
        )
    }

    function startForcedRestartTimer() {
        forcedRestartInterval = setTimeout(() => {
            stopPulseSensor()
            sessionEnded.value = true
        },
        forcedRestartTimeout()
       )
    }

    function resetForcedRestartTimer() {
        clearTimeout(forcedRestartInterval)
    }

    function stopSignalLossTimer() {
        clearTimeout(signalLossInterval)
        sensorError.value = false
    }

    function resetSignalLossTimer() {
        stopSignalLossTimer()
        startSignalLossTimer()
    }

</script>
<style scoped>
    #ibi {
        text-decoration-color: cornflowerblue;
        font-size: 80px;
        margin: 20px;
    }
    .pulse-sensor-button {
        padding: 8px;
        font-size: 18px;
        font-weight: bold;
        margin-right: 4px;
        margin-top: 5px;
    }
</style>