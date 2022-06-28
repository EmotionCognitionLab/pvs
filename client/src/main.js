import { ipcRenderer } from 'electron'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

import SetupComponent from './components/SetupComponent.vue'
import TimerComponent from './components/TimerComponent.vue'
import UploadComponent from './components/UploadComponent.vue'
import LoginComponent from './components/LoginComponent.vue'
import LumosityComponent from './components/LumosityComponent.vue'
import BreathComponent from './components/BreathComponent.vue'
import Stage2Component from './components/Stage2Component.vue'

import { isAuthenticated, getAuth } from '../../common/auth/auth'
import { SessionStore } from './session-store'

function stage1Complete() {
    return  window.localStorage.getItem('HeartBeam.isConfigured') === 'true'
}

function stage2Complete() {
    const res = ipcRenderer.sendSync('is-stage-2-complete', SessionStore.getRendererSession())
    return res
}

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection: ', promise, 'reason: ', reason)
})

const routes = [
    { path: '/setup', component: SetupComponent, props: {loggedIn: false} },
    { path: '/timer/:secondsDuration', component: TimerComponent, props: true, name: 'timer' },
    { path: '/upload', component: UploadComponent },
    { path: '/signin', component: LoginComponent, name: 'signin', props: true },
    { path: '/login/index.html', component: LoginComponent }, // to match the oauth redirect we get
    { path: '/breath', component: BreathComponent },
    { path: '/lumos', component: LumosityComponent },
    { path: "/stage2", component: Stage2Component },
]

const noAuthRoutes = ['/signin', '/login/index.html', '/setup', '/']

const router = createRouter({
    history: createWebHistory(),
    routes: routes
})

// use navigation guards to decided 
// which stage is to be done and 
// handle authentication
router.beforeEach((to) => {
    if (!isAuthenticated() && !noAuthRoutes.includes(to.path)) {
        return { name: 'signin', params: { 'postLoginPath': to.path } }
    }

    if (to.path === '/current-stage' || to.path === '/') {
        if (!stage1Complete()) {
            return {path: '/setup'}
        } else if (!isAuthenticated()) {
            return { name: 'signin', params: { postLoginPath: '/current-stage' }}
        } else if (!stage2Complete()) {
            return {path: '/stage2'}
        } else {
            return {path: '/breath'}
        }
    }

    return true
})

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

const app = createApp(App)
app.use(router)

app.mount('#app')
