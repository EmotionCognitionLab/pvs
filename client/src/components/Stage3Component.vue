<template>
    <div v-if="lumosDataReady">
        <div v-if="!lumosityDone">
            <LumosityComponent @lumosityFinished="finishedLumosity()"/>
        </div>
        <div v-if="firstTimeStep == 1" class="instruction">
            In this video Dr. Mather discusses the paced breathing exercises you will be doing in the next part of this study.
            <br/>
            <iframe width="560" height="315" src="https://www.youtube.com/embed/piwhKqlcI8M" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            <br/>
            <button @click="firstTimePage=2" class="button">Continue</button>
        </div>
        <div v-if="firstTimeStep == 2" class="instruction">
            <p>
                Great job! Now we will ask you to breathe at different paces for about 15 minutes.
                You will see a ball moving up or down along a line.
                You should breathe in as it moves up and breathe out as it moves down.
                The pace of these cues will change every few minutes.
                You should continually try to match your breathing pace to the pacer.
            </p>
            <p>
                If you start to feel lightheaded or dizzy, try breathing less deeply.
                If that doesn't help, remove the sensor from your ear and take a break.
                Try again later when you're feeling better.
                Try to breathe in a relaxed way without taking in more air than necessary to stay in synchrony with the pacer.
            </p>
            <button class="button" @click="firstTimePage=3">Continue</button>
        </div>
        <div v-if="firstTimeStep > 2 && firstTimeStep < 5" class="instruction">
            <div v-if="firstTimeStep == 3">
                <p>
                    You should try to breathe through your nose rather than your mouth.
                    You also should try to use your diaphragm when doing these breathing exercises.
                    The diaphragm is a large, dome-shaped muscle located at the base of the lungs.
                    Your abdominal muscles help move the diaphragm and give you more power to empty your lungs.
                </p>
                <p>
                    Learning to do diaphragmatic breathing has many benefits!
                    You can decrease your oxygen demand and use less effort and energy to breathe.
                </p>
                <button class="button" @click="firstTimePage=4">Continue</button>
            </div>
            <div v-if="firstTimeStep == 4">
                Please take a moment to try out diaphragmatic breathing: 
                <ul class="left-list">
                    <li>In a comfortable seat, sit up straight and relax your neck and shoulders. Place both feet flat on the floor.</li>
                    <li>Put one hand on your chest and the other on your stomach.</li>
                    <li>Inhale slowly through your nose and feel your stomach expand into your hand. Exhale slowly through pursed lips, feeling your stomach muscles tighten and fall inward. The hand on your chest should stay still while the hand on your stomach moves outward and inward with each breath.</li>
                </ul>
                <p>
                    You may notice an increased effort will be needed to use the diaphragm correctly.
                    At first, you'll probably get tired while doing this exercise.
                    But keep at it, because with continued training, diaphragmatic breathing will become easy and automatic.
                </p>
                <button class="button" @click="firstTimePage=5">Continue</button>
            </div>
        </div>
        <div v-if="showDayFiveVid && lumosityDone">
            In this video Dr. Mather discusses the connection between breathing, the heart and the brain.
            <br/>
            <iframe width="560" height="315" src="https://www.youtube.com/embed/BAlxN0nmnao" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            <br/>
            <button class="button" @click="day5VidDone">Continue</button>
        </div>
        <div :class="{hidden: sessionDone || dayDone || !lumosityDone || firstTimeStep < 5 || showDayFiveVid}">
            <PacedBreathingComponent :startRegimes="regimes" :condition="condition" @pacerFinished="pacerFinished" />
        </div>
        <div class="instruction" v-if="sessionDone && !dayDone">
            All done! Please come back later today to do your next session.
            <br/>
            <button class="button" @click="setRegimes">Start Next Session</button>
        </div>
        <div class="instruction" v-else-if="sessionDone && dayDone">
            <UploadComponent>
                <template #preUploadText>
                    <div class="instruction">Terrific! Please wait while we upload your data...</div>
                </template>
                <template #postUploadText>
                        <div class="instruction">Upload complete. You're all done for today! Please come back tomorrow for more training.</div>
                    <br/>
                    <button class="button" @click="quit">Quit</button>
                </template>
            </UploadComponent>
        </div>
    </div>
    <div class="instruction" v-else>
        One moment while we load your data...
    </div>
</template>
<script setup>
import { ref, onBeforeMount, computed } from '@vue/runtime-core'
import ApiClient from '../../../common/api/client.js'
import { SessionStore } from '../session-store.js'
import PacedBreathingComponent from './PacedBreathingComponent.vue'
import UploadComponent from './UploadComponent.vue'
import LumosityComponent from './LumosityComponent.vue'
import { useLumosityHelper, completedLumosity } from '../lumosity-helper.js'

const regimes=ref([])
const sessionDone = ref(false)
let dayDone = ref(false)
const condition = ref(null)
const lumosDays = ref(null)
const lumosityDone = ref(null)
const lumosDataReady = ref(null)
const firstTimePage = ref(1)
const firstTimeStep = computed(() => {
    if (window.localStorage.getItem("HeartBeam.hasReadPBInst") === "true" && firstTimePage.value === 1) return 5;
    if (firstTimePage.value == 3) {
        window.localStorage.setItem("HeartBeam.hasReadPBInst", "true")
        if (condition.value != 'A') {
            // then they don't need to see the diaphragmatic breathing instructions
            return 4
        }
    }
    return firstTimePage.value
})
const showDayFiveVid = ref(false)

async function setRegimes() {
    const sessRegimes = await window.mainAPI.regimesForSession(condition.value, 3)
    dayDone.value = sessRegimes.length == 0
    sessionDone.value = sessRegimes.length == 0
    regimes.value = sessRegimes
}

onBeforeMount(async() => {
    window.mainAPI.setStage(3)
    const { days, done, ready } = await useLumosityHelper()
    lumosDays.value = days
    lumosityDone.value = done
    lumosDataReady.value = ready
    showDayFiveVid.value = await shouldShowDayFiveVid()
    const session = await SessionStore.getRendererSession()
    const apiClient = new ApiClient(session)
    const data = await apiClient.getSelf()
    condition.value = data.condition.assigned
    await setRegimes()
})

async function shouldShowDayFiveVid() {
    if (window.localStorage.getItem('HeartBeam.hasSeenPBVid') === 'true') return false

    const pbDays = await window.mainAPI.getPacedBreathingDays(3)
    const firstPbDay = Math.min(...pbDays)
    const firstPbDayStr = new String(firstPbDay)
    const firstPbDate = new Date(`${firstPbDayStr.substring(0, 4)}-${firstPbDayStr.substring(4, 6)}-${firstPbDayStr.substring(6, 8)}`) // ignore timezones; we don't need that much precision
    const now = new Date()
    const days = (now - firstPbDate) / (1000 * 60 * 60 * 24)
    return days >=5
}

function day5VidDone() {
    window.localStorage.setItem('HeartBeam.hasSeenPBVid', 'true')
    showDayFiveVid.value = false
}

async function pacerFinished() {
    sessionDone.value = true
    setTimeout(async () => { // use setTimeout to avoid race condition with the data from last regime being saved
        // note we don't set regimes.value here
        // doing so reloads the PacedBreathingComponent, losing its reference
        // to the emwaveListener before we successfully stop the pulse sensor
        const sessRegimes = await window.mainAPI.regimesForSession(condition.value, 3)
        dayDone.value = sessRegimes.length == 0
    }, 50) 
}

async function finishedLumosity() {
    await completedLumosity(lumosDays.value)
    lumosityDone.value = true
}

function quit() {
    window.mainAPI.quit()
}

</script>
<style scope>
 .button {
        padding: 8px;
        font-size: 18px;
        font-weight: bold;
        margin-right: 4px;
        margin-top: 5px;
    }
 .hidden {
    display: none;
 }
 .left-list {
    text-align: left;
 }
</style>