<template>
    <div>
        <header>
            <img v-bind:src="require('../assets/logo.png')" id="logo"> After completing the Lumosity games below, please click <span @click="leave">here</span>.
        </header>
    </div>
</template>

<script setup>
    import { ipcRenderer } from "electron";
    import { onMounted } from '@vue/runtime-core';
    import ApiClient from '../../../common/api/client.js'
    import { SessionStore } from '../session-store.js'

    const emit = defineEmits(['lumosity-finished'])

    onMounted(async () => {
        let email = window.localStorage.getItem('HeartBeam.lumos.e')
        let pw = window.localStorage.getItem('HeartBeam.lumos.p')
        if (!email || email.length === 0 || !pw || pw.length === 0) {
            const session = SessionStore.getRendererSession()
            const apiClient = new ApiClient(session)
            const lumosCreds = await apiClient.getLumosCredsForSelf()
            window.localStorage.setItem('HeartBeam.lumos.e', lumosCreds.email)
            window.localStorage.setItem('HeartBeam.lumos.p', lumosCreds.pw)
            email = lumosCreds.email
            pw = lumosCreds.pw
        }
        ipcRenderer.send("create-lumosity-view", email, pw);
    })


    function leave() {
        ipcRenderer.send("close-lumosity-view");
        emit('lumosity-finished');
    }
    

</script>

<style scoped>
    header {
        height: 40px;
        padding: 5px auto 5px;
        margin: 0 auto auto 0;
    }
    header span {
        cursor: pointer;
        text-decoration: underline;
        color: blue;
    }
    header span:hover {
        text-decoration: none;
    }
    #logo {
        vertical-align: middle;
    }
</style>
