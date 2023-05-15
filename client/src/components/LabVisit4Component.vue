<template>
    <div>
        <h2>Welcome to Lab Visit 4</h2>
        <div :class="{hidden: sessionDone}">
            <PacedBreathingComponent :showScore="true" :startRegimes="regimes" :condition="condition" @pacerFinished="pacerFinished" />
        </div>
        <div class="instruction" v-if="sessionDone">
            <UploadComponent>
                <template #preUploadText>
                    <div class="instruction">Terrific! Please wait while we upload your data...</div>
                </template>
                <template #postUploadText>
                        <div class="instruction">Upload complete. Please let the researcher know.</div>
                    <br/>
                    <button class="button" @click="quit">Quit</button>
                </template>
            </UploadComponent>
        </div>
    </div>
</template>

<script setup>
import { ref, onBeforeMount } from '@vue/runtime-core'
import ApiClient from '../../../common/api/client.js'
import { SessionStore } from '../session-store.js'
import PacedBreathingComponent from './PacedBreathingComponent.vue'
import UploadComponent from './UploadComponent.vue'

const regimes=ref([])
const sessionDone = ref(false)
const condition = ref(null)

async function setRegimes() {
    const sessRegimes = await window.mainAPI.regimesForVisit4(condition.value, 3)
    regimes.value = sessRegimes
}

onBeforeMount(async() => {
    window.mainAPI.setStage(3)
    const session = await SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    const data = await apiClient.getSelf()
    condition.value = data.condition.assigned
    await setRegimes()
})

async function pacerFinished() {
    sessionDone.value = true
}

function quit() {
    window.mainAPI.quit()
}
</script>
