<template>
    <div v-if="currentlyLoggedIn"><ConditionAssignmentComponent /></div>
    <div v-else>
        <br/>
        <LoginComponent />
    </div>
</template>

<script setup>
    import { ref } from '@vue/runtime-core';
    import { ipcRenderer } from 'electron'
    import LoginComponent from './LoginComponent.vue'
    import ConditionAssignmentComponent from './ConditionAssignmentComponent.vue'

    const loggedIn = ref(true)
    let currentlyLoggedIn = ref(loggedIn.value)
    ipcRenderer.on('login-succeeded', () => {
        currentlyLoggedIn.value = true
    })
</script>
