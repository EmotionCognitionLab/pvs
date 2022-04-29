<template>
    <div>
        <header>
            After completing the Lumosity segment, please click <span @click="leave">here</span>.
        </header>
    </div>
</template>

<script setup>
    import { ipcRenderer } from "electron";
    import { useRouter } from "vue-router";
    const router = useRouter();
    function leave() {
        ipcRenderer.send("close-lumosity-view");
        router.push({path: "/"});
    }
    ipcRenderer.send("create-lumosity-view");
</script>

<style scoped>
    header {
        height: 40px;
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
