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

    function upload() {
        ipcRenderer.send('upload-emwave-data', SessionStore.getRendererSession())
    }
</script>
