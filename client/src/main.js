import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'

import SetupComponent from './components/SetupComponent.vue'
import TimerComponent from './components/TimerComponent.vue'
import UploadComponent from './components/UploadComponent.vue'

const routes = [
    { path: '/setup', component: SetupComponent, props: {loggedIn: false} },
    { path: '/timer/:secondsDuration', component: TimerComponent, props: true, name: 'timer' },
    { path: '/upload', component: UploadComponent }
]
const router = createRouter({
    history: createWebHashHistory(),
    routes: routes
})

const app = createApp(App)
app.use(router)

const isConfigured = window.localStorage.getItem('HeartBeam.isConfigured')
if (isConfigured === 'true') {
    const secondsDuration = 300
    router.push({ name: 'timer', params: { secondsDuration } })
} else {
    router.push('/setup')
}

app.mount('#app')
