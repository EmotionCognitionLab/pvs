<template>
    <div class="instruction" v-if="windowReady && !lumosityDone">
        <LumosityComponent @lumosityFinished="completedLumosity"/>
    </div>
    <div class="instruction" v-else-if="lumosityDone && !restBreathingDone">
        <RestComponent @timerFinished="restBreathingDone=true" />
    </div>
    <div v-else-if="lumosityDone && restBreathingDone">
        <UploadComponent>
            <template #preUploadText>
                <div class="instruction">Terrific! Please wait while we upload your data...</div>
            </template>
            <template #postUploadText>
                    <div class="instruction">Upload complete! Please come back tomorrow for more training.</div>
                <br/>
                <button class="button" @click="quit">Quit</button>
            </template>
        </UploadComponent>
    </div>
</template>
<script setup>
import { ipcRenderer } from 'electron'
import { ref, onMounted } from '@vue/runtime-core'
import LumosityComponent from './LumosityComponent.vue'
import RestComponent from './RestComponent.vue'
import UploadComponent from './UploadComponent.vue'
import ApiClient from '../../../common/api/client.js'
import { SessionStore } from '../session-store.js'

const lumosityDone = ref(false)
const windowReady = ref(false)
const restBreathingDone = ref(false)
let session
let apiClient
let lumosDays = []

onMounted(async () => {
    windowReady.value = true
    session = SessionStore.getRendererSession()
    apiClient = new ApiClient(session)
    const data = await apiClient.getSelf()
    if (data.lumosDays && data.lumosDays.length > 0) {
        lumosDays = data.lumosDays
    }
})

async function completedLumosity() {
    lumosityDone.value = true
    const session = SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    const now = new Date()
    lumosDays.push(`${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2,0)}${now.getDate().toString().padStart(2, 0)}`)
    await apiClient.updateSelf({lumosDays: lumosDays})
}

function quit() {
    ipcRenderer.invoke('quit')
}

</script>