<template>
    <div>
        To set up the HeartBEAM application, you'll first need to log in to your HeartBEAM account. Click the "Get Started" button when you're ready to begin.
        <br/>
        <button id="startSetup" @click="login">Get Started</button>
    </div>
</template>
<script setup>
    import { ipcRenderer } from 'electron'

    const login = () => {
        ipcRenderer.send('show-login-window')
    }

</script>
