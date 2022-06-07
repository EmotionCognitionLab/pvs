<template>
    <router-view></router-view>
</template>

<script setup>
import { Logger } from '../../common/logger/logger.js'

new Logger()
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
