<template>
    <div>
        <slot name="bodyText">Please log in to continue.<br/></slot>
        <button id="startSetup" @click="login">
            <slot name="btnText">Login</slot>
        </button>
    </div>
</template>
<script setup>
    import { ipcRenderer } from 'electron'
    import { useRoute } from "vue-router";

    const route = useRoute();

    const login = () => {
        if (route.query.postLoginPath !== undefined) {
            window.sessionStorage.setItem('HeartBeam.postLoginPath', route.query.postLoginPath)
        }
        ipcRenderer.send('show-login-window')
    }

</script>
