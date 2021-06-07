<template>
    <div id="ibi">{{ ibi }}</div>
</template>
<script>
import { ipcRenderer } from 'electron'
import { ref } from '@vue/runtime-core'
export default {
    name: 'EmWaveListener',
    setup() {
        let ibi = ref(0)

        ipcRenderer.on('emwave-ibi', (event, message) => {
            ibi.value = Number(message)
        });

        const startPulseSensor = () => {
            ipcRenderer.send('pulse-start')
        }

        const stopPulseSensor = () => {
            ipcRenderer.send('pulse-stop')
        }

        return { ibi, startPulseSensor, stopPulseSensor }
    },

}
</script>
<style scoped>
    #ibi {
        text-decoration-color: cornflowerblue;
        font-size: 80px;
        margin: 20px;
    }
</style>