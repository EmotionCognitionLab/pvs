import ApiClient from '../../common/api/client.js'
import { SessionStore } from './session-store.js'
import { yyyymmddString } from './utils.js'

export async function useLumosityHelper() {
    const session = await SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)

    const data = await apiClient.getSelf()
    
    let lumosityDone = false
    if (data.lumosDays && data.lumosDays.length > 0) {
        const today = yyyymmddString(new Date())
        if (data.lumosDays.indexOf(today) !== -1) lumosityDone = true
    } else if (!data.lumosDays) {
        data.lumosDays = []
    }

    return { days: data.lumosDays, done: lumosityDone, ready: true }
}

export async function completedLumosity(prevLumosDays) {
    const session = await SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    await apiClient.updateSelf({lumosDays: prevLumosDays.concat(yyyymmddString(new Date()))})
}
