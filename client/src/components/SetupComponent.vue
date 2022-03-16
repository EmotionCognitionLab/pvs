<template>
    <div v-if="currentlyLoggedIn"><condition-assignment-component></condition-assignment-component></div>
    <div v-else>
        <br/>
        <LoginComponent></LoginComponent>
    </div>
</template>
<script>
import { ref, toRefs } from '@vue/runtime-core';
import { ipcRenderer } from 'electron'
import LoginComponent from './LoginComponent.vue'
import ConditionAssignmentComponent from './ConditionAssignmentComponent.vue'
// import SubjectNumberComponent from './SubjectNumberComponent.vue'

export default {
    name: 'SetupComponent',
    components: { LoginComponent, ConditionAssignmentComponent },
    props: {
        loggedIn: {
            type: Boolean,
            required: true
        }
    },
    setup(props) {
        const { loggedIn } = toRefs(props)
        let currentlyLoggedIn = ref(loggedIn.value)
        ipcRenderer.on('login-succeeded', () => {
            currentlyLoggedIn.value = true
        })
        return { currentlyLoggedIn }
    },
}
</script>