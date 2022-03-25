<template>
    <div>
        <canvas ref="pacer"></canvas>
    </div>
</template>
<script setup>
    import { BreathPacer } from 'pvs-breath-pacer'
    import { onMounted, ref, watch } from '@vue/runtime-core';

    const props = defineProps(['msPerBreath', 'totalMs', 'holdMs'])
    const pacer = ref(null)
    let running = ref(false)
    defineExpose({running})
    const emit = defineEmits(['pacer-finished'])
    let bp = null

    watch(running, (shouldRun) => {
        if (shouldRun) {
            bp.start()
            .then(() => {
                emit('pacer-finished')
            })
        }
    })

    onMounted(() => {
        bp = new BreathPacer(pacer.value, [])
        bp.setPaceAndDuration(props.msPerBreath, props.totalMs, props.holdMs)
    })
</script>
<style scoped>
    canvas {
        background-color: mintcream;
        width: 1200px;
        height: 400px;
    }
</style>