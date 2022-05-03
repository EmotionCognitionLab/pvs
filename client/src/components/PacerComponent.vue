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
    let start = ref(false)
    let pause = ref(false)
    let resume = ref(false)
    defineExpose({start, pause, resume})
    const emit = defineEmits(['pacer-finished'])
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