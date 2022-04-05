<template>
    <div>
        <canvas ref="pacer" width="1200" height="400"></canvas>
    </div>
</template>
<script setup>
    import { BreathPacer } from 'pvs-breath-pacer'
    import { onMounted, ref, watch } from '@vue/runtime-core';

    const props = defineProps(['msPerBreath', 'totalMs', 'holdMs', 'scaleH', 'scaleT', 'offsetProportionX', 'offsetProportionY'])
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
        const pacerConfig = {
            scaleH: props.scaleH,
            scaleT: props.scaleT,
            offsetProportionX: props.offsetProportionX,
            offsetProportionY: props.offsetProportionY
        }
        bp = new BreathPacer(pacer.value, [], pacerConfig)
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