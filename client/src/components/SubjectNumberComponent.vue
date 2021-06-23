<template>
    Great! You're all logged in. Next, ask the researcher to enter your subject number.
    <br/>
    <div id="subjectNumForm">
        <label for="subjectNum">Subject Number</label>
        <input v-model="subjNum" type="text" name="subjectNum" id="subjectNum" />
        <button id="saveSubject" @click="saveSubjectNum">Submit</button>
    </div>
</template>
<script>
import { ref } from '@vue/runtime-core';
export default {
    name: 'SubjectNumberComponent',
    setup() {
        let subjNum = ref('')
        const saveSubjectNum = () => {
           console.log(`TODO: save ${subjNum.value} to dynamo and write isConfigured to local storage`)
        }

        return { subjNum, saveSubjectNum }
    }
}
</script>
<style scoped>
    #subjectNumForm { padding: 12px 10px; }
    #subjectNum { margin: 6px; }
</style>