<template>
    <div>
        <canvas ref="pacer" width="1200" height="600" ></canvas>
    </div>
</template>
<script setup>
    import { BreathPacer } from 'pvs-breath-pacer'
    import { onMounted, ref } from '@vue/runtime-core';

    // const props = defineProps(['canvasElem'])
    const pacer = ref(null)

    const DEFAULT_INSTRUCTIONS = [
        {duration: 4000, breathe: "in"},
        {duration: 4000, breathe: "hold"},
        {duration: 4000, breathe: "out"},
        {duration: 4000, breathe: "hold"},
    ]

    onMounted(() => {
        const bp = new BreathPacer(pacer.value, DEFAULT_INSTRUCTIONS)
        bp.start()
    })

</script>