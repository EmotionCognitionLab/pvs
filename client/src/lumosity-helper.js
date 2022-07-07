import { ref } from '@vue/runtime-core'
import ApiClient from '../../common/api/client.js'
import { SessionStore } from './session-store.js'

function todayYYYYMMDD() {
    const now = new Date()
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2,0)}${now.getDate().toString().padStart(2, 0)}`
}

export function useLumosityHelper() {
    const session = SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    const lumosDays = ref([])
    const lumosityDone = ref(false)
    const lumosDataReady = ref(false)

    apiClient.getSelf()
    .then(data => {
        if (data.lumosDays && data.lumosDays.length > 0) {
            lumosDays.value = data.lumosDays
            const today = todayYYYYMMDD()
            if (data.lumosDays.indexOf(today) !== -1) lumosityDone.value = true
        }
        lumosDataReady.value = true
    })

    return { lumosDays: lumosDays, lumosityDone: lumosityDone, lumosDataReady: lumosDataReady }
}

export async function completedLumosity(prevLumosDays) {
    const session = SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    await apiClient.updateSelf({lumosDays: prevLumosDays.concat(todayYYYYMMDD())})
}
