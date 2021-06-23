<template>
    To set up the HeartBEAM application, you'll first need to log in to your HeartBEAM account. Click the "Get Started" button when you're ready to begin.
    <br/>
    <button id="startSetup" @click="login">Get Started</button>
</template>
<script>
import { ipcRenderer } from 'electron'


export default {
    setup() {
        const login = () => {
            ipcRenderer.send('show-login-window')
        }

        return { login }
    },
    name: 'LoginComponent'
}
</script>
