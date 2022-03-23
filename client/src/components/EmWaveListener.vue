<template>
    <div>
        <div v-if="!calibrated && running && !sensorError">
            Waiting for pulse signal..
        </div>
        <div v-if="sensorError">
            No or poor signal detected. Please make sure the device is connected properly and your earlobe is warm.
            (If it is cold, try rubbing it between your thumb and forefinger to warm it up and get blood flowing to it.)
        </div>
        <button class="pulse-sensor-button" id="startSensor" @click="startPulseSensor">Start</button>
        <button class="pulse-sensor-button" id="stopSensor" @click="stopPulseSensor">Stop</button>
        <div v-if="showIbi" id="ibi">{{ ibi }}</div>
    </div>
   
</template>
<script setup>
    import { ipcRenderer } from 'electron'
    import { ref, watch } from '@vue/runtime-core'

    defineProps(['showIbi'])
    const emit = defineEmits(['pulse-sensor-calibrated', 'pulse-sensor-stopped'])
    let ibi = ref(0)
    let calibrated = ref(false)
    let running = ref(false)
    let sensorError = ref(false)
    let errInterval = null
    let stopSensor = ref(false)
    defineExpose({stopSensor})

    const errTimeout = () => !calibrated.value ? 30000 : 10000 // allows longer time for signal acquisition at start of session

    watch(running, (isRunning) => {
        if (isRunning) {
            startErrorTimer()
        } else {
            stopErrorTimer()
        }
    })

    watch(stopSensor, (shouldStopSensor) => {
        if (shouldStopSensor) {
            stopPulseSensor()
        }
    })

    ipcRenderer.on('emwave-ibi', (event, message) => {
        ibi.value = Number(message)
        if (ibi.value <= 0) return

        if (!calibrated.value) {
            calibrated.value = true
            emit('pulse-sensor-calibrated')
        }
        resetErrorTimer()
    })

    // eslint-disable-next-line no-unused-vars
    function startPulseSensor() {
        ipcRenderer.send('pulse-start')
        running.value = true
        stopSensor.value = false
    }
    
    // eslint-disable-next-line no-unused-vars
    function stopPulseSensor() {
        ipcRenderer.send('pulse-stop')
        emit('pulse-sensor-stopped')
        running.value = false
        calibrated.value = false
    }

    function startErrorTimer() {
        errInterval = setTimeout(() => sensorError.value = true, errTimeout())
    }

    function stopErrorTimer() {
        clearTimeout(errInterval)
        sensorError.value = false
    }

    function resetErrorTimer() {
        stopErrorTimer()
        startErrorTimer()
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