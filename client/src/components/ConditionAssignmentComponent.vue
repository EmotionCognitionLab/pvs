<template>
    <div>Great! You're all logged in. Next we need to know a little bit more about you:
        <br/>
        <div id="conditionAssignmentForm">
            <div>
                <label for="yob">What year were you born?</label>
                <input v-model="yob" type="text" name="yob" id="yob">
                <span v-if="errors['yob']" class="error">
                    {{ errors.yob }}
                </span>
            </div>
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
                <label for="sexDescription">Do you describe yourself as a man, a woman, or in some other way?</label>
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
import { reactive } from 'vue';

let sex = ref('')
let yob = ref('')
let sexDescription = ref('')
const errors = reactive({});
const sexOptions = reactive(['Male', 'Female', 'Intersex'])
const sexDescriptionOptions = reactive(['Man', 'Woman', 'Other'])

// eslint-disable-next-line no-unused-vars
function assignToCondition() {
    validate();
    if (Object.keys(errors).length) {
        console.log(errors);
    } else {
        console.log(`TODO: save ${yob.value}, ${sex.value} and ${sexDescription.value} to dynamo and assign to condition`)
    }
}

function validate() {
    errors['yob'] = null
    errors['sex'] = null
    errors['sexDescription'] = null

    if (!yobIsValid()) {
        errors['yob'] = 'Please enter a valid year (between 1952 and 1977).'
    }

    if (!sexOptions.includes(sex.value)) {
        errors['sex'] = 'Please select an option'
    }

    if (sex.value === 'Intersex' && !sexDescriptionOptions.includes(sexDescription.value)) {
        errors['sexDescription'] = 'Please select an option'
    }
}

function textToNum(text) {
    return parseInt(text.trim());
}

function yobIsValid() {
    let yobNum;
    try {
        yobNum = textToNum(yob.value);
        return yobNum >= 1952 && yobNum <= 1977;
    } catch (err) {
        console.error(err);
        return false;
    }
}

</script>
<style scoped>
    div { text-align: left; padding-bottom: 15px; }
    label {padding: 12px;}
    #conditionAssignmentForm { padding: 12px 10px; width: 700px}
    #yob { width: 40px; }
    .error { color: red; font-size: 90%; padding-left: 20px; }
</style>