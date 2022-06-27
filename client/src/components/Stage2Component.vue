<template>
    <div class="instruction" v-if="windowReady && !lumosityDone">
        <LumosityComponent @lumosityFinished="completedLumosity"/>
    </div>
    <div class="instruction" v-else>
        <RestComponent />
    </div>
</template>
<script setup>
import { ref, onMounted } from '@vue/runtime-core'
import LumosityComponent from './LumosityComponent.vue'
import RestComponent from './RestComponent.vue'
import ApiClient from '../../../common/api/client.js'
import { SessionStore } from '../session-store.js'

const lumosityDone = ref(false)
const windowReady = ref(false)
let session
let apiClient
let lumosDays = []

onMounted(async () => {
    windowReady.value = true
    session = await SessionStore.getRendererSession()
    apiClient = new ApiClient(session)
    const data = await apiClient.getSelf()
    if (data.lumosDays && data.lumosDays.length > 0) {
        lumosDays = data.lumosDays
    }
})

async function completedLumosity() {
    lumosityDone.value = true
    const session = await SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    const now = new Date()
    lumosDays.push(`${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2,0)}${now.getDate().toString().padStart(2, 0)}`)
    await apiClient.updateSelf({lumosDays: lumosDays})
}

</script>