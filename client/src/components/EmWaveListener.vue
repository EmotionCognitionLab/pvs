<template>
    <div id="ibi">{{ ibi }}</div>
</template>
<script setup>
    import { ipcRenderer } from 'electron'
    import { ref } from '@vue/runtime-core'

    let ibi = ref(0)

    ipcRenderer.on('emwave-ibi', (event, message) => {
        ibi.value = Number(message)
    });

    // eslint-disable-next-line no-unused-vars
    function startPulseSensor() {
        ipcRenderer.send('pulse-start')
    }
    
    // eslint-disable-next-line no-unused-vars
    function stopPulseSensor() {
        ipcRenderer.send('pulse-stop')
    }

</script>
<style scoped>
    #ibi {
        text-decoration-color: cornflowerblue;
        font-size: 80px;
        margin: 20px;
    }
</style>