<template>
    <div>
        This is a placeholder template for the emwave upload UI.
        <br/>
        Click the button to upload your emWave data.
        <button @click="login">Login</button>
        <button @click="upload">Upload Data</button>
    </div>
</template>
<script setup>
    import { ipcRenderer } from 'electron'
    import { SessionStore } from '../session-store.js'

    function login() {
         ipcRenderer.send('show-login-window')
    }

    async function upload() {
        await ipcRenderer.invoke('upload-emwave-data', SessionStore.getRendererSession())
        await ipcRenderer.invoke('upload-breath-data', SessionStore.getRendererSession())
    }
</script>
