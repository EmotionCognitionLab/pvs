<template>
    <div v-if="lumosDataReady">
        <div v-if="!lumosityDone">
            <LumosityComponent @lumosityFinished="finishedLumosity()"/>
        </div>
        <div :class="{hidden: sessionDone || dayDone || !lumosityDone}">
            <PacedBreathingComponent :startRegimes="regimes" :condition="condition" @pacerFinished="pacerFinished" />
        </div>
        <div class="instruction" v-if="sessionDone && !dayDone">
            All done! Please come back later today to do your next session.
            <br/>
            <button class="button" @click="setRegimes">Start Next Session</button>
        </div>
        <div class="instruction" v-else-if="sessionDone && dayDone">
            <UploadComponent>
                <template #preUploadText>
                    <div class="instruction">Terrific! Please wait while we upload your data...</div>
                </template>
                <template #postUploadText>
                        <div class="instruction">Upload complete. You're all done for today! Please come back tomorrow for more training.</div>
                    <br/>
                    <button class="button" @click="quit">Quit</button>
                </template>
            </UploadComponent>
        </div>
    </div>
    <div class="instruction" v-else>
        One moment while we load your data...
    </div>
</template>
<script setup>
import { ipcRenderer } from 'electron'
import { ref, onBeforeMount } from '@vue/runtime-core'
import ApiClient from '../../../common/api/client.js'
import { SessionStore } from '../session-store.js'
import PacedBreathingComponent from './PacedBreathingComponent.vue'
import UploadComponent from './UploadComponent.vue'
import LumosityComponent from './LumosityComponent.vue'
import { useLumosityHelper, completedLumosity } from '../lumosity-helper.js'

const regimes=ref([])
const sessionDone = ref(false)
let dayDone = ref(false)
const condition = ref(null);
const { lumosDays, lumosityDone, lumosDataReady } = useLumosityHelper()

async function setRegimes() {
    const sessRegimes = await ipcRenderer.invoke('regimes-for-session', condition.value)
    dayDone.value = sessRegimes.length == 0
    sessionDone.value = sessRegimes.length == 0
    regimes.value = sessRegimes
}

onBeforeMount(async() => {
    const session = SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    const data = await apiClient.getSelf()
    condition.value = data.condition.assigned
    await setRegimes()
})

async function pacerFinished() {
    sessionDone.value = true
    setTimeout(async () => { // use setTimeout to avoid race condition with the data from last regime being saved
        // note we don't set regimes.value here
        // doing so reloads the PacedBreathingComponent, losing its reference
        // to the emwaveListener before we successfully stop the pulse sensor
        const sessRegimes = await ipcRenderer.invoke('regimes-for-session', condition.value)
        dayDone.value = sessRegimes.length == 0
    }, 50) 
}

async function finishedLumosity() {
    await completedLumosity(lumosDays.value)
    lumosityDone.value = true
}

function quit() {
    ipcRenderer.invoke('quit')
}

</script>
<style scope>
 .button {
        padding: 8px;
        font-size: 18px;
        font-weight: bold;
        margin-right: 4px;
        margin-top: 5px;
    }
 .hidden {
    display: none;
 }
</style>