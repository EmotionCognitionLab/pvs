<template>
    <div id="#app"><router-view></router-view></div>
</template>

<script setup>
import { Logger } from '../../common/logger/logger.js'
import { getCurrentUser } from '../../common/auth/auth.js'
import { ipcRenderer } from 'electron'

new Logger(true, getCurrentUser())

ipcRenderer.on('get-current-user', () => {
  ipcRenderer.send('current-user', getCurrentUser())
})

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
.instruction {
    max-width: 40em;
    padding: 2.5%;
    margin: auto;
}
</style>
