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
import EarningsComponent from './components/EarningsComponent.vue'
import StreakComponent from './components/StreakComponent.vue'
import DoneTodayComponent from './components/DoneTodayComponent.vue'
import LabVisit4Component from './components/LabVisit4Component.vue'
import OauthRedirectComponent from './components/OauthRedirectComponent'

import { isAuthenticated, getAuth } from '../../common/auth/auth'
import ApiClient from '../../common/api/client.js'
import { SessionStore } from './session-store'
import { yyyymmddString } from './utils'

async function stage1Complete() {
    return await window.mainAPI.isStage1Complete()
}

const routes = [
    { path: '/setup', component: SetupComponent, props: {loggedIn: false} },
    { path: '/timer/:secondsDuration', component: TimerComponent, props: true, name: 'timer' },
    { path: '/upload', component: UploadComponent },
    { path: '/signin', component: LoginComponent, name: 'signin', props: true },
    { path: '/login/index.html', component: OauthRedirectComponent }, // to match the oauth redirect we get
    { path: '/stage3', component: Stage3Component },
    { path: '/earnings', component: EarningsComponent },
    { path: '/streak', component: StreakComponent },
    { path: '/lumos', component: LumosityComponent },
    { path: '/stage2', component: Stage2Component },
    { path: '/donetoday', component: DoneTodayComponent},
    { path: '/current-stage', beforeEnter: chooseStage},
    { path: '/visit4', component: LabVisit4Component},
    { path: '/', beforeEnter: streakOrSetup }
]

const noAuthRoutes = ['/signin', '/login/index.html', '/setup', '/', '/index.html']

const router = createRouter({
    history: process.env.IS_ELECTRON ? createWebHashHistory() : createWebHistory(),
    routes: routes
})

function streakOrSetup() {
    // no-auth check to see if they've even started assignment to condition
    if (window.localStorage.getItem('HeartBeam.isConfigured') !== 'true') {
        return {path: '/setup'}
    }
    // if they've at least been assigned to condition, they need to log in
    // for us to be able to show the streak page
    if (!isAuthenticated()) {
        return { name: 'signin', query: { postLoginPath: '/streak' }}
    }

    return {path: '/streak'}
}

async function chooseStage() {
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

    const stage1Status = await stage1Complete()
    if (!stage1Status.complete) return {path: '/setup'}
    
    if (stage1Status.complete && stage1Status.completedOn == todayYMD) {
        return {path: '/donetoday'}
    }

    const sess = await SessionStore.getRendererSession()
    const apiClient = new ApiClient(sess)
    const data = await apiClient.getSelf()
    if (!data.stage2Completed) return {path: '/stage2'}
    // the data on which stage2 completion is judged
    // are from the previous day, so we assume
    // that if they're finished with stage 2 they
    // must not have finished it today
    return {path: '/stage3'}
}

// use navigation guards to handle authentication
router.beforeEach(async (to) => {
    if (!isAuthenticated() && !noAuthRoutes.includes(to.path)) {
        return { name: 'signin', query: { 'postLoginPath': to.path } }
    }

    const sess = await SessionStore.getRendererSession()
    if (isAuthenticated() && !sess) {
        const cognitoAuth = getAuth()
        cognitoAuth.userhandler = {
            onSuccess: session => {
                window.mainAPI.loginSucceeded(session)
                SessionStore.session = session
            },
            onFailure: err => console.error(err)
        }
        cognitoAuth.getSession()
    }

    return true
})

window.mainAPI.onShowEarnings(() => {
    router.push({path: '/earnings'});
})

window.mainAPI.onShowTasks(() => {
    router.push({path: '/current-stage'});
})

window.mainAPI.onShowVisit4(() => {
    router.push({path: '/visit4'})
})

const app = createApp(App)
app.use(router)

app.mount('#app')
