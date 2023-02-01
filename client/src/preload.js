import { ipcRenderer, contextBridge } from 'electron'
contextBridge.exposeInMainWorld('mainAPI', {
    isStage1Complete: async () => await ipcRenderer.invoke('is-stage-1-complete'),
    loginSucceeded: (session) => ipcRenderer.invoke('login-succeeded', session),
    onGetCurrentUser: (callback) => ipcRenderer.on('get-current-user', callback),
    onShowEarnings: (callback) => ipcRenderer.on('show-earnings', callback),
    onShowTasks: (callback) => ipcRenderer.on('show-tasks', callback),
    getRestBreathingDays: async (stage) => await ipcRenderer.invoke('get-rest-breathing-days', stage),
    getPacedBreathingDays: async (stage) => await ipcRenderer.invoke('get-paced-breathing-days', stage),
    getSegmentsAfterDate: async (date, stage) => await ipcRenderer.invoke('get-segments-after-date', date, stage),
    getLastShownDateTimeForBonusType: async(bonusType) => await ipcRenderer.invoke('get-last-shown-date-time-for-bonus-type', bonusType),
    setLastShownDateTimeForBonusType: async(bonusType, lastShownDateTime) => await ipcRenderer.invoke('set-last-shown-date-time-for-bonus-type', bonusType, lastShownDateTime),
    setStage: (stage) => ipcRenderer.invoke('set-stage', stage),
    showLoginWindow: () => ipcRenderer.send('show-login-window'),
    createLumosityView: (email, pw, userAgent) => ipcRenderer.send("create-lumosity-view", email, pw, userAgent),
    closeLumosityView: () => ipcRenderer.send("close-lumosity-view"),
    pacerRegimeChanged: async (startTime, regime) => await ipcRenderer.invoke('pacer-regime-changed', startTime, regime),
    regimesForSession: async(condition, stage) => await ipcRenderer.invoke('regimes-for-session', condition, stage),
    uploadEmWaveData: async(session) => ipcRenderer.invoke('upload-emwave-data', session),
    uploadBreathData: async(session) => ipcRenderer.invoke('upload-breath-data', session),
    startPulseSensor: () => ipcRenderer.send('pulse-start'),
    stopPulseSensor: () => ipcRenderer.send('pulse-stop'),
    handleEmWaveIBIEvent: (callback) => ipcRenderer.on('emwave-ibi', callback),
    handleEmWaveStatusEvent: (callback) => ipcRenderer.on('emwave-status', callback),
    disableMenus: async () => ipcRenderer.invoke('disable-menus'),
    quit: () => ipcRenderer.invoke('quit'),
})
