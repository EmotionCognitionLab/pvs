import { ipcRenderer, contextBridge } from 'electron'
contextBridge.exposeInMainWorld('mainAPI', {
    isStage1Complete: async () => await ipcRenderer.invoke('is-stage-1-complete'),
    loginSucceeded: (session) => ipcRenderer.invoke('login-succeeded', session),
    onGetCurrentUser: (callback) => ipcRenderer.on('get-current-user', callback),
    getRestBreathingDays: async (stage) => await ipcRenderer.invoke('get-rest-breathing-days', stage),
    getPacedBreathingDays: async (stage) => await ipcRenderer.invoke('get-paced-breathing-days', stage),
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
    quit: () => ipcRenderer.invoke('quit'),
})
