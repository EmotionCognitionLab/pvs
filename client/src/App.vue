<template>
  <TimerComponent v-bind:secondsDuration=300 @timerStarted="handleTimerStart" @timerStopped="handleTimerStop"></TimerComponent>
  <br/>
  <em-wave-listener ref="emWaveListener"></em-wave-listener>
</template>

<script>
import TimerComponent from './components/TimerComponent.vue'
import EmWaveListener from './components/EmWaveListener.vue'
import { ref } from '@vue/runtime-core'

export default {
  name: 'App',
  components: {
    EmWaveListener,
    TimerComponent
  },
  setup() {
    const emWaveListener = ref(null)
    const handleTimerStart = () => {
      emWaveListener.value.startPulseSensor()
    }
    const handleTimerStop = () => {
      emWaveListener.value.stopPulseSensor()
    }

    return {emWaveListener, handleTimerStart, handleTimerStop}
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
