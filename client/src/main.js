import { ipcRenderer } from 'electron'
import { createApp } from 'vue'
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import App from './App.vue'

import SetupComponent from './components/SetupComponent.vue'
import TimerComponent from './components/TimerComponent.vue'
import UploadComponent from './components/UploadComponent.vue'
import LoginComponent from './components/LoginComponent.vue'
import LumosityComponent from './components/LumosityComponent.vue'
import Stage3Component from './components/Stage3Component.vue'
import Stage2Component from './components/Stage2Component.vue'
import DoneTodayComponent from './components/DoneTodayComponent.vue'

import { isAuthenticated, getAuth } from '../../common/auth/auth'
import { SessionStore } from './session-store'
import { yyyymmddString } from './utils'

function stage1Complete() {
    const res = ipcRenderer.sendSync('is-stage-1-complete')
    return res
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
    { path: '/stage3', component: Stage3Component },
    { path: '/lumos', component: LumosityComponent },
    { path: '/stage2', component: Stage2Component },
    { path: '/donetoday', component: DoneTodayComponent},
    { path: '/current-stage', redirect: chooseStage},
    { path: '/', redirect: chooseStage }
]

const noAuthRoutes = ['/signin', '/login/index.html', '/setup', '/', '/index.html']

const router = createRouter({
    history: process.env.IS_ELECTRON ? createWebHashHistory() : createWebHistory(),
    routes: routes
})

function chooseStage() {
    const todayYMD = yyyymmddString(new Date());

    // no-auth check to see if they've even started assignment to condition
    if (window.localStorage.getItem('HeartBeam.isConfigured') !== 'true') {
        return {path: '/setup'}
    }
    // if they've at least been assigned to condition, they need to log in
    // for us to be able to download their db (if necessary) and check to 
    // see which breathing exercises they've done
    if (!isAuthenticated()) {
        return { name: 'signin', query: { postLoginPath: '/current-stage' }}
    }

    const stage1Status = stage1Complete()
    if (!stage1Status.complete) return {path: '/setup'}
    
    if (stage1Status.complete && stage1Status.completedOn == todayYMD) {
        return {path: '/donetoday'}
    }

    const stage2Status = stage2Complete()
    if (!stage2Status.complete) return {path: '/stage2'}
    if (stage2Status.completedOn != todayYMD) {
        return {path: '/stage3'}
    } else {
        return {path: '/donetoday'}
    }
}

// use navigation guards to handle authentication
router.beforeEach((to) => {
    if (!isAuthenticated() && !noAuthRoutes.includes(to.path)) {
        return { name: 'signin', query: { 'postLoginPath': to.path } }
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
