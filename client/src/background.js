'use strict'

import { app, protocol, BrowserWindow, BrowserView, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import unhandled from 'electron-unhandled'
const isDevelopment = process.env.NODE_ENV !== 'production'
import emwave from './emwave'
import s3Utils from './s3utils.js'
import { emWaveDbPath, deleteShortSessions as deleteShortEmwaveSessions } from './emwave-data'
import { breathDbPath, closeBreathDb, getRestBreathingDays } from './breath-data'
import { getRegimesForSession } from './regimes'
import path from 'path'
const AmazonCognitoIdentity = require('amazon-cognito-auth-js')
import awsSettings from '../../common/aws-settings.json'
import { Logger } from '../../common/logger/logger.js'
import { SessionStore } from './session-store.js'
import ApiClient from '../../common/api/client.js'
import fetch from 'node-fetch'
// fetch is defined in browsers, but not node
// substitute node-fetch here
globalThis.fetch = fetch

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

// use electron-unhandled to catch unhandled errors/promise rejections
unhandled()

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
  // emwave.hideEmWave()
  new Logger()
})

app.on('before-quit', () => {
  emwave.stopEmWave()
  closeBreathDb()
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
  try {
    const auth = new AmazonCognitoIdentity.CognitoAuth(awsSettings)
    auth.useCodeGrantFlow();
    const url = auth.getFQDNSignIn();
    mainWin.loadURL(url)
    mainWin.webContents.on('will-redirect', async (event, newUrl) => {
      // we want the renderer (main) window to load the redirect from the oauth server
      // so that it gets the session and can store it
      if (newUrl.startsWith(awsSettings.RedirectUriSignIn)) {
        if (process.env.WEBPACK_DEV_SERVER_URL) {
          // Load the url of the dev server if in development mode
          await mainWin.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
        } else {
          await mainWin.loadURL('app://./index.html')
        }
        mainWin.webContents.send('oauth-redirect', newUrl)
        event.preventDefault()
      }
    })
  } catch (err) {
    console.log(err)
  } 
})

let lumosityView = null;

// handles login page, returns true if login successfully attempted
function lumosityLogin(email, password) {
    const emailInput = document.getElementById("user_login");
    const passwordInput = document.getElementById("user_password");
    const formSubmit = document.querySelector('input[type="submit"][value="Log In"]');
    if (emailInput && passwordInput && formSubmit) {
        emailInput.value = email;
        passwordInput.value = password;
        formSubmit.click();
        return true;
    } else {
        return false;
    }
}

function lumosityLoginJS(email, password) {
    return `(${lumosityLogin})("${email}", "${password}")`;
}

function lumosityEmailValid(email) {
  if (email.match(/heart|demobeam[0-9]{3}@hcp.lumoslabs.com/)) return true;
  return false;
}

function lumosityPasswordValid(pw) {
  if (pw.match(/[a-z]+/)) return true;
  return false;
}

ipcMain.on('create-lumosity-view', async (_event, email, password) => {
    if (lumosityView) {
        return;
    }
    if (!mainWin) {
      // if we're going staight to Lumosity on startup we may need to
      // wait a bit for main window initialization
      await new Promise(resolve => setTimeout(() => resolve(), 200))
    }

    if (!lumosityEmailValid(email)) {
      throw new Error('You must provide a valid Lumosity email address.');
    }
    if (!lumosityPasswordValid(password)) {
      throw new Error("You must provide a valid Lumosity password.");
    }
    lumosityView = new BrowserView();
    mainWin.setBrowserView(lumosityView);
    lumosityView.setAutoResize({width: true, height: true, vertical: true});
    lumosityView.setBounds({x: 0, y: 100, width: 1284, height: 593});  // hardcoded!!!
    // handle first login page load
    lumosityView.webContents.once("did-finish-load", () => {
        lumosityView.webContents.executeJavaScript(lumosityLoginJS(email, password));
    });
    lumosityView.webContents.loadURL("https://www.lumosity.com/login");
});

ipcMain.on('close-lumosity-view', () => {
    if (!mainWin || !lumosityView) {
        return;
    }
    mainWin.removeBrowserView(lumosityView);
    lumosityView = null;
});

ipcMain.handle('upload-emwave-data', async (event, session) => {
  emwave.stopEmWave();
  deleteShortEmwaveSessions();
  const emWaveDb = emWaveDbPath();
  const fullSession = SessionStore.buildSession(session);
  await s3Utils.uploadFile(fullSession, emWaveDb)
  .catch(err => {
    console.error(err);
    return (err.message);
  });
  return null;
});

ipcMain.handle('upload-breath-data', async (event, session) => {
  closeBreathDb();
  const breathDb = breathDbPath();
  const fullSession = SessionStore.buildSession(session);
  await s3Utils.uploadFile(fullSession, breathDb)
  .catch(err => {
    console.error(err);
    return (err.message);
  });
  return null;
});

ipcMain.handle('regimes-for-session', (_event, subjCondition) => {
  return getRegimesForSession(subjCondition);
});

ipcMain.handle('get-rest-breathing-days', () => {
  return getRestBreathingDays();
});

/**
 * Stage 2 is complete when either (a) the user has done six Lumosity sessions, or
 * (b) when the user has done four or five Lumosity sessions AND at least six calendar
 * days have passed since the first one.
 * @returns true or false
 */
 async function stage2Complete(session) {
  const restBreathingDays = getRestBreathingDays();
  if (restBreathingDays.size < 3) return false; // spec calls for minimum 2, but they do 1 during setup that doesn't count for this

  const apiClient = new ApiClient(session);
  const data = await apiClient.getSelf();
  if (!data.lumosDays || data.lumosDays.length === 0) return false;

  const daySet = new Set(data.lumosDays);
  if (daySet.size <= 3) return false;
  if (daySet.size >= 6) return true;

  const dayArr = new Array(...daySet);
  dayArr.sort((a, b) => parseInt(a) - parseInt(b));
  const startDay = new Date(dayArr[0].substring(0,4), parseInt(dayArr[0].substring(4,6))-1, dayArr[0].substring(6,8));
  const now = new Date();
  const diffMs = now - startDay;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 6;
}

ipcMain.on('is-stage-2-complete', async(_event, session) => {
  const res = await stage2Complete(SessionStore.buildSession(session))
  _event.returnValue = res
})

ipcMain.handle('quit', () => {
  app.quit();
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
