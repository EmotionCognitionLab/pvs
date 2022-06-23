import { ipcRenderer } from 'electron'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'

import SetupComponent from './components/SetupComponent.vue'
import TimerComponent from './components/TimerComponent.vue'
import UploadComponent from './components/UploadComponent.vue'
import LoginComponent from './components/LoginComponent.vue'
import LumosityComponent from './components/LumosityComponent.vue'
import BreathComponent from './components/BreathComponent.vue'
import RestComponent from './components/RestComponent.vue'

import { isAuthenticated, getAuth } from '../../common/auth/auth'
import { SessionStore } from './session-store'

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection: ', promise, 'reason: ', reason)
})

const routes = [
    { path: '/setup', component: SetupComponent, props: {loggedIn: false} },
    { path: '/timer/:secondsDuration', component: TimerComponent, props: true, name: 'timer' },
    { path: '/upload', component: UploadComponent },
    { path: '/signin', component: LoginComponent },
    { path: '/login/index.html', component: LoginComponent }, // to match the oauth redirect we get
    { path: '/breath', component: BreathComponent, name: 'breath' },
    { path: '/lumos', component: LumosityComponent },
    { path: '/rest', component: RestComponent, name: 'rest' }
]

// const noAuthRoutes = ['/signin', '/login/index.html', '/setup']

const router = createRouter({
    history: createWebHashHistory(),
    routes: routes
})

// use navigation guards to handle 
// setup and authentication
// router.beforeEach((to) => {
//     const isConfigured = window.localStorage.getItem('HeartBeam.isConfigured')
//     if (isConfigured !== 'true' && !noAuthRoutes.includes(to.path)) {
//         return { path: '/setup' }
//     }

//     if (!isAuthenticated() && !noAuthRoutes.includes(to.path)) {
//         return { path: '/signin' }
//     }

//     return true
// })

if (isAuthenticated() && !SessionStore.getRendererSession()) {
    const cognitoAuth = getAuth()
    cognitoAuth.userhandler = {
        onSuccess: session => {
            ipcRenderer.invoke('login-succeeded', session)
            SessionStore.session = session
        },
        onFailure: err => console.error(err)
    }
    cognitoAuth.getSession()
}

/* eslint-disable no-unexpected-multiline */
(async () => {
    const app = createApp(App)
    app.use(router)

    app.mount('#app')
    // if there are no rest breathing segments, do that
    const avgRestCoherence = await ipcRenderer.invoke('avg-rest-coherence')
    if (avgRestCoherence === null) {
        router.push({name: 'rest'})
    } else {
        // otherwise, send them to the breath component
        router.push({name: 'breath'})
    }
})()


