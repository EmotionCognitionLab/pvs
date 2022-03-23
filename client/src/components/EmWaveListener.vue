<template>
    <div>
        <div v-if="!calibrated && running">
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
    import { ref } from '@vue/runtime-core'

    defineProps(['showIbi'])
    const emit = defineEmits(['pulse-sensor-calibrated', 'pulse-sensor-stopped'])
    let ibi = ref(0)
    let calibrated = ref(false)
    let running = ref(false)
    let sensorError = ref(false)

    ipcRenderer.on('emwave-ibi', (event, message) => {
        ibi.value = Number(message)
        if (!calibrated.value && ibi.value > 0) {
            calibrated.value = true
            emit('pulse-sensor-calibrated')
        }
    });

    // eslint-disable-next-line no-unused-vars
    function startPulseSensor() {
        ipcRenderer.send('pulse-start')
        running.value = true
    }
    
    // eslint-disable-next-line no-unused-vars
    function stopPulseSensor() {
        ipcRenderer.send('pulse-stop')
        emit('pulse-sensor-stopped')
        running.value = false
        calibrated.value = false
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