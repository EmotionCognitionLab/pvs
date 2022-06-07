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
    const email = window.localStorage.getItem('HeartBeam.lumos.e')
    const pw = window.localStorage.getItem('HeartBeam.lumos.p')
    // TODO check that email and pw are really set (and fetch from dynamo if not)
    ipcRenderer.send("create-lumosity-view", email, pw);

</script>

<style scoped>
    header {
        height: 40px;
        padding: 5px auto 5px;
        margin: 0 auto auto 0;
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
