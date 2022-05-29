<template>
    <div>
        <div v-if="errors.general" class="error">
            An error ocurred. Please contact the study administrators and tell them you received the following error during assignment to condition:
            <br/>
            {{ errors.general }}
        </div>
        Great! You're all logged in. Next we need to know a little bit more about you:
        <br/>
        <div id="conditionAssignmentForm">
            <div>
                <label for="sex">Were you born male or female?</label>
                <select v-model="sex" name="sex" id="sex">
                    <option disabled value="">Please select one</option>
                    <option v-for="(item, index) in sexOptions" :key="index">{{ item }}</option>
                </select>
                <span v-if="errors.sex" class="error">
                    {{ errors.sex }}
                </span>
            </div>
            <div  v-if="sex === 'Intersex'">
                <label for="sexDescription">Do you describe yourself as male, female, or in some other way?</label>
                <span v-if="errors.sexDescription" class="error">
                    {{ errors.sexDescription }}
                </span>
                <br/>
                <select v-model="sexDescription" name="sexDescription" id="sexDescription">
                    <option disabled value="">Please select one</option>
                    <option v-for="(item, index) in sexDescriptionOptions" :key="index">{{ item }}</option>
                </select>
            </div>
            <br/>
            <button id="save" @click="assignToCondition">Submit</button>
        </div>
    </div>
</template>
<script setup>
import { ref } from '@vue/runtime-core';
import { defineEmits } from 'vue';
import { reactive } from 'vue';
import ApiClient from '../../../common/api/client.js'
import { SessionStore } from '../session-store.js'


let sex = ref('')
let sexDescription = ref('')
const errors = reactive({});
const sexOptions = reactive(['Male', 'Female', 'Intersex'])
const sexDescriptionOptions = reactive(['Male', 'Female', 'Other'])
const emit = defineEmits(['complete'])

// eslint-disable-next-line no-unused-vars
async function assignToCondition() {
    validate();
    if (!Object.keys(errors).length) {
        try {
            const session = await SessionStore.getRendererSession()
            const apiClient = new ApiClient(session)
            await apiClient.assignToCondition({bornSex: sex.value, sexDesc: sexDescription.value})

            // we'll also assign them their lumosity info here
            const lumosCreds = await apiClient.getLumosCredsForSelf()

            window.localStorage.setItem('HeartBeam.lumos.e', lumosCreds.email)
            window.localStorage.setItem('HeartBeam.lumos.p', lumosCreds.pw)
            window.localStorage.setItem('HeartBeam.isConfigured', 'true')
            emit('complete')
        } catch (err) {
            console.error(err)
            errors['general'] = `${err.message}`
            throw(err)
        }
    }
}

function validate() {
    delete(errors['sex'])
    delete(errors['sexDescription'])
    delete(errors['general'])

    if (!sexOptions.includes(sex.value)) {
        errors['sex'] = 'Please select an option'
    }

    if (sex.value === 'Intersex' && !sexDescriptionOptions.includes(sexDescription.value)) {
        errors['sexDescription'] = 'Please select an option'
    }
}

</script>
<style scoped>
    div { text-align: left; padding-bottom: 15px; }
    label {padding: 12px;}
    #conditionAssignmentForm { padding: 12px 10px; width: 700px}
    .error { color: red; font-size: 90%; padding-left: 20px; }
</style>