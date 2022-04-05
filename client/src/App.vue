<template>
 <!-- 
  <TimerComponent v-bind:secondsDuration=300 @timerStarted="handleTimerStart" @timerStopped="handleTimerStop"></TimerComponent>
  <br/>
 <em-wave-listener ref="emWaveListener"></em-wave-listener> 
  <br/>
  <web-page-component source="https://wikipedia.org"></web-page-component>
  -->
    <router-view></router-view>
</template>

<script>
// import TimerComponent from './components/TimerComponent.vue'
// import EmWaveListener from './components/EmWaveListener.vue'
// import { ref } from '@vue/runtime-core'

export default {
  name: 'App',
  components: {
    // EmWaveListener,
    // TimerComponent
  },
  setup() {
    // const emWaveListener = ref(null)
    // const handleTimerStart = () => {
    //   emWaveListener.value.startPulseSensor()
    // }
    // const handleTimerStop = () => {
    //   emWaveListener.value.stopPulseSensor()
    // }

    // return {emWaveListener, handleTimerStart, handleTimerStop}
  }
}
</script>

<style>
body {
  font-family: Arial, sans-serif;
  font-size: 22px;
  line-height: 1.6em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  background-color: beige;
  height: 100%;
  width: 100%;
}
#app {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
</style>
