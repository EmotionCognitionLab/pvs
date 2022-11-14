<template>
    <div>
        <div ref="payErr">
        </div>
        <div ref="payInfo">

        </div>
    </div>
</template>
<script setup>
import { ref, onBeforeMount } from '@vue/runtime-core'
import { SessionStore } from '../session-store.js'
import { Payboard } from "pay-info"
import ApiClient from "../../../common/api/client.js"
import Db from "../../../common/db/db.js"
import { getCurrentUser } from '../../../common/auth/auth.js'

const payErr = ref(null)
const payInfo = ref(null)

onBeforeMount(async () => {
    const session = await SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    const db = new Db({session: session})
    const pb = new Payboard(payInfo.value, payErr.value, apiClient, db, getCurrentUser(), false)
    pb.refresh()
})

</script>