<template>
    <div>
        <div id="timer">{{ timeLeft }}</div>
        <div v-if="showButtons">
            <button class="timer-button" id="startTimer" @click="startTimer">Start</button>
            <button class="timer-button" id="stopTimer" @click="stopTimer">Stop</button>
        </div>
    </div>
</template>
<script setup>
    import { ref, computed, watch } from 'vue'

    const props = defineProps(['secondsDuration', 'showButtons'])
    const emit = defineEmits(['timer-started', 'timer-stopped', 'timer-finished'])
    let running = ref(false)
    defineExpose({running})

    let secondsRemaining = ref(props.secondsDuration)
    let interval = null

    watch(running, (isRunning) => {
        if (isRunning) {
            startTimer()
        } else {
            stopTimer()
        }
    })

    const timeLeft = computed(() => {
        const minutes = Math.floor(secondsRemaining.value / 60)
        const seconds = secondsRemaining.value % 60
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    })

    function startTimer() {
        interval = setInterval(() => updateSecondsRemaining(), 1000)
        emit('timer-started')
    }

    function stopTimer() {
        clearInterval(interval)
        emit('timer-stopped')
    }

    function updateSecondsRemaining() {
        secondsRemaining.value -= 1
        if (secondsRemaining.value <= 0) {
            clearInterval(interval)
            emit('timer-finished')
        }
    }
</script>
<style scoped>
    #timer {
        font-size: 64px;
        margin: 5px 5px 15px 5px;
    }
    .timer-button {
        padding: 8px;
        font-size: 18px;
        font-weight: bold;
        margin-right: 4px;
    }
</style>