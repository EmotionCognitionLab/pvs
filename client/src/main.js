import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'

import SetupComponent from './components/SetupComponent.vue'
import TimerComponent from './components/TimerComponent.vue'

const routes = [
    { path: '/setup', component: SetupComponent, props: {loggedIn: false} },
    { path: '/timer/:secondsDuration', component: TimerComponent, props: true, name: 'timer' }
]
const router = createRouter({
    history: createWebHashHistory(),
    routes: routes
})

const app = createApp(App)
app.use(router)

const isConfigured = window.localStorage.getItem('pvs.isConfigured')
console.log(`pvs.isConfigured: ${isConfigured}`);
if (isConfigured === 'true') {
    const secondsDuration = 300
    router.push({ name: 'timer', params: { secondsDuration } })
} else {
    router.push('/setup')
}

app.mount('#app')
