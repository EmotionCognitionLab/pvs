<template>
    <div id="timer">{{ timeLeft }}</div>
    <button class="timer-button" id="startTimer" @click="startTimer">Start</button>
    <button class="timer-button" id="stopTimer" @click="stopTimer">Stop</button>
</template>
<script>
import { ref, toRefs } from '@vue/runtime-core';
export default {
    name: 'TimerComponent',
    props: {
        secondsDuration: {
            type: Number,
            required: true
        }
    },
    emits: ['timerStarted', 'timerStopped'],
    computed: {
        timeLeft() {
            const minutes = Math.floor(this.secondsRemaining / 60)
            const seconds = this.secondsRemaining % 60
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        }
    },
    setup(props, { emit }) {
        const { secondsDuration } = toRefs(props)
        let secondsRemaining = ref(secondsDuration.value)
        let interval = null

        const startTimer = () => {
            interval = setInterval(() => updateSecondsRemaining(), 1000)
            emit('timerStarted')
        }

        const stopTimer = () => {
            clearInterval(interval)
            emit('timerStopped')
        }

        const updateSecondsRemaining = () => {
            secondsRemaining.value -= 1
            if (secondsRemaining.value <= 0) {
                clearInterval(interval)
            }
        }

        return { secondsRemaining, startTimer, stopTimer }
    }
}
</script>
<style scoped>
    #timer {
        font-size: 64px;
    }
    .timer-button {
        padding: 8px;
        font-size: 18px;
        font-weight: bold;
        margin-right: 4px;
    }
</style>