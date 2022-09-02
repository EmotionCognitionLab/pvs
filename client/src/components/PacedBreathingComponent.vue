<template>
    <div class="instruction-small">
        We have one remaining task for you today.
        Please breathe following the ball on the screen.
        Breathe in while the ball is moving up and breathe out while the ball is moving down.
        Pause your breathing when the ball is not going up or down.
        Make sure you have the pulse device attached to your ear, and click "Start" when you're ready to begin.
        <PacerComponent 
            :regimes="startRegimes"
            :scaleH=290
            :scaleT=0.1 
            :offsetProportionX=0.25
            :offsetProportionY=0.8
            @pacerFinished="pacerFinished"
            ref="pacer" />
        <TimerComponent :secondsDuration=secondsDuration :showButtons=false :countBy="'minutes'" ref="timer" />
        <EmWaveListener :showIbi=false :showScore=true :condition=condition @pulseSensorCalibrated="startPacer" @pulseSensorStopped="stopPacer" @pulseSensorSignalLost="stopPacer" @pulseSensorSignalRestored="resumePacer" ref="emwaveListener"/>
    </div>
</template>

<script setup>
    import { ref, computed } from '@vue/runtime-core'
    import PacerComponent from './PacerComponent.vue'
    import TimerComponent from './TimerComponent.vue'
    import EmWaveListener from './EmWaveListener.vue'

    const props = defineProps(['startRegimes', 'condition'])
    const emit = defineEmits(['pacer-started', 'pacer-stopped', 'pacer-finished'])

    const pacer = ref(null)
    const emwaveListener = ref(null)
    const timer = ref(null)
    const secondsDuration = computed(() => {
        return (props.startRegimes.reduce((prev, cur) => prev + cur.durationMs, 0)) / 1000
    })

    async function pacerFinished() {
        emwaveListener.value.stopSensor = true
        timer.value.running = false
        emit('pacer-finished')
    }

    function startPacer() {
        if (pacer) pacer.value.start = true
        if (timer) timer.value.running = true
        emit('pacer-started')
    }

    function stopPacer() {
        pacer.value.pause = true
        timer.value.running = false
        emit('pacer-stopped')
    }

    function resumePacer() {
        pacer.value.resume = true
        timer.value.running = true
        emit('pacer-started')
    }
</script>

<style scoped>
.instruction-small {
    max-width: 60em;
    font-size: 80%;
    padding-left: 40px;
 }
</style>