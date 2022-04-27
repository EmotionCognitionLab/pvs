<template>
    <div>
        <header>
            After completing the Lumosity segment, please click <span @click="leave">here</span>.
        </header>
        <iframe src="https://example.com/" width="1200" height="800"></iframe>
    </div>
</template>
<script setup>
    import { useRouter } from "vue-router";
    const router = useRouter();
    function leave() {
        router.push({path: "/"});
    }
</script>
<style scoped>
    header {
        margin: 5px auto 5px;
    }
    header span {
        cursor: pointer;
        text-decoration: underline;
        color: blue;
    }
    header span:hover {
        text-decoration: none;
    }
</style>
