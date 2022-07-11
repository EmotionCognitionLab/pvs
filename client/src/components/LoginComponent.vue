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
    import { defineEmits } from 'vue';
    import { useRouter } from "vue-router";
    import { getAuth } from '../../../common/auth/auth.js'
    import { SessionStore } from '../session-store.js'

    const router = useRouter();
    const props = defineProps(['postLoginPath'])
    const emit = defineEmits(['login-succeeded'])
    const cognitoAuth = getAuth()
    cognitoAuth.userhandler = {
        onSuccess: (session) => {
            SessionStore.session = session
            emit('login-succeeded')
            ipcRenderer.invoke('login-succeeded', session)
            const dest = window.sessionStorage.getItem('HeartBeam.postLoginPath')
            if (dest !== null) { 
                window.sessionStorage.removeItem('HeartBeam.postLoginPath')
                router.push({path: dest})
            } else {
                // default dest is /
                router.push({path: '/'})
            }
        },
        onFailure: err => console.error(err)
    }
    const curUrl = window.location.href;
    if (curUrl.indexOf('?') > -1) {
        // we're handling a redirect from the oauth server
        cognitoAuth.parseCognitoWebResponse(curUrl)
    }

    ipcRenderer.on('oauth-redirect', (_event, respUrl) => {
        cognitoAuth.parseCognitoWebResponse(respUrl)
    })

    const login = () => {
        if (props.postLoginPath !== undefined) {
            window.sessionStorage.setItem('HeartBeam.postLoginPath', props.postLoginPath)
        }
        ipcRenderer.send('show-login-window')
    }

</script>
