<template>
    <div>
        <canvas ref="pacer" width="1200" height="400"></canvas>
    </div>
</template>
<script setup>
    import { BreathPacer } from 'pvs-breath-pacer'
    import { onMounted, ref, watch } from '@vue/runtime-core';
    import { isProxy, toRaw } from 'vue'
    import { ipcRenderer } from 'electron';

    const props = defineProps(['regimes', 'scaleH', 'scaleT', 'offsetProportionX', 'offsetProportionY'])
    const pacer = ref(null)
    let start = ref(false)
    let pause = ref(false)
    let resume = ref(false)
    defineExpose({start, pause, resume})
    const emit = defineEmits(['pacer-finished', 'pacer-regime-changed'])
    let bp = null

    watch(start, (shouldStart) => {
        if (shouldStart) {
            bp.start()
            .then(() => {
                emit('pacer-finished')
            })
            pause.value = false
        }
    })

    watch(pause, (shouldPause) => {
        if (shouldPause) {
            bp.pause()
            start.value = false
            resume.value = false
        }
    })

    watch(resume, (shouldResume) => {
        if (shouldResume) {
            bp.resume()
            pause.value = false
        }
    })

    async function regimeChanged(startTime, regime) {
        await ipcRenderer.invoke('pacer-regime-changed', startTime, regime);
        emit('pacer-regime-changed', startTime, regime);
    }

    onMounted(() => {
        const pacerConfig = {
            scaleH: props.scaleH,
            scaleT: props.scaleT,
            offsetProportionX: props.offsetProportionX,
            offsetProportionY: props.offsetProportionY
        }
        bp = new BreathPacer(pacer.value, [], pacerConfig)
        bp.subscribeToRegimeChanges(regimeChanged)
        // if we don't do this we'll fail to emit regime-changed
        // events b/c Object.clone (used by electron's ipc event system)
        // doesn't work on vue proxies
        const rawRegimes = isProxy(props.regimes) ? toRaw(props.regimes) : props.regimes
        bp.setInstructions(rawRegimes)
    })
</script>
<style scoped>
    canvas {
        background-color: mintcream;
        width: 1200px;
        height: 400px;
    }
</style>