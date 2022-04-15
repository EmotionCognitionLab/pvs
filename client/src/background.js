'use strict'

import { app, protocol, BrowserWindow, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
const isDevelopment = process.env.NODE_ENV !== 'production'
import emwave from './emwave'
import dataUpload from './data-upload.js'
import path from 'path'
const AmazonCognitoIdentity = require('amazon-cognito-auth-js')
import awsSettings from '../../common/aws-settings.json'
import { Logger } from '../../common/logger/logger.js'
import fetch from 'node-fetch'
// fetch is defined in browsers, but not node
// substitute node-fetch here
globalThis.fetch = fetch

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

let mainWin = null

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1300,
    height: 700,
    webPreferences: {
      
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }
  return win
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  emwave.startEmWave()
  mainWin = await createWindow()
  emwave.createClient(mainWin)
  new Logger()
})

app.on('before-quit', () => {
  emwave.stopEmWave()
})

ipcMain.on('pulse-start', () => {
  emwave.startPulseSensor()
})

ipcMain.on('pulse-stop', () => {
  emwave.stopPulseSensor()
})

// btoa and atob are defined in global browser contexts,
// but not node. Define them here b/c amazon-cognito-auth-js
// expects them to exist
if (typeof btoa === 'undefined') {
  global.btoa = function (str) {
    return Buffer.from(str, 'binary').toString('base64');
  };
}

if (typeof atob === 'undefined') {
  global.atob = function (b64Encoded) {
    return Buffer.from(b64Encoded, 'base64').toString('binary');
  };
}

ipcMain.on('show-login-window', () => {
  let authWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    'node-integration': false
  })
  try {
    const auth = new AmazonCognitoIdentity.CognitoAuth(awsSettings)
    auth.useCodeGrantFlow();
    const url = auth.getFQDNSignIn();
    authWindow.loadURL(url)
    authWindow.show()
    authWindow.webContents.on('will-redirect', (event, newUrl) => {
      // we want the renderer (main) window to load the redirect from the oauth server
      // so that it gets the session and can store it
      mainWin.loadURL(newUrl)
      authWindow.close()
    })
    authWindow.on('closed', () => { authWindow = null })
  } catch (err) {
    console.log(err)
  } 
})

ipcMain.handle('upload-emwave-data', async (event, session) => {
    emwave.stopEmWave();
    await dataUpload.uploadEmWaveDb(session)
    .catch(err => {
      console.error(err);
      return (err.message);
    });
  return null;
});

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}
