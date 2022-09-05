'use strict'

import { app, protocol, BrowserWindow, BrowserView, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import unhandled from 'electron-unhandled'
const isDevelopment = process.env.NODE_ENV !== 'production'
import emwave from './emwave'
import s3Utils from './s3utils.js'
import { yyyymmddNumber, yyyymmddString } from './utils'
import { emWaveDbPath, deleteShortSessions as deleteShortEmwaveSessions } from './emwave-data'
import { breathDbPath, closeBreathDb, getRestBreathingDays, getPacedBreathingDays } from './breath-data'
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
  mainWin.webContents.send('get-current-user')
  emwave.createClient(mainWin)
  emwave.hideEmWave()
})

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWin) {
      if (mainWin.isMinimized()) {
        mainWin.restore();
      }

      mainWin.show();
  }
});


ipcMain.on('current-user', (_event, user) => {
  new Logger(true, user)
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
  const remoteLogger = new Logger(false)
  try {
    const auth = new AmazonCognitoIdentity.CognitoAuth(awsSettings)
    auth.useCodeGrantFlow();
    const url = auth.getFQDNSignIn();
    mainWin.loadURL(url)
    
    mainWin.webContents.on('will-redirect', async (event, oauthRedirectUrl) => {
      if (!oauthRedirectUrl.startsWith(awsSettings.RedirectUriSignIn)) return

      event.preventDefault()
      // depending on how the oauth flow went, the main window may now be showing
      // an Amazon Cognito page. We need to re-load the app and tell it to handle
      // the oauth response.
      // we want the renderer window to load the response from the oauth server
      // so that it gets the session and can store it
      
      // // in prod mode app URLs start with 'app://'
      const query = oauthRedirectUrl.indexOf('?') > 0 ? oauthRedirectUrl.slice(oauthRedirectUrl.indexOf('?')) : ''
      const oauthHandler = process.env.WEBPACK_DEV_SERVER_URL ? `http://localhost:8080/./index.html#/login/index.html${query}` : `app://./index.html#/login/index.html${query}`
      try {
        await mainWin.loadURL(oauthHandler)  
      } catch (err) {
        // For unknown reasons, the mainWin.loadURL call above reliably triggers
        // ERR_ABORTED (or sometimes ERR_FAILED). Wrapping it in a setTimeout 
        // (so it happens after the will-redirect handler is over) does not help.
        if (!err.message.startsWith("ERR_ABORTED") && !err.message.startsWith("ERR_FAILED")) {
          remoteLogger.error(err)
          throw(err)
        }
      }
    }) 
    
  } catch (err) {
    remoteLogger.error(err)
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

ipcMain.on('create-lumosity-view', async (_event, email, password, userAgent) => {
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
    lumosityView.setBounds({x: 0, y: 60, width: 1284, height: 593});  // hardcoded!!!
    // handle first login page load
    lumosityView.webContents.once("did-finish-load", () => {
        lumosityView.webContents.executeJavaScript(lumosityLoginJS(email, password));
    });
    lumosityView.webContents.loadURL("https://www.lumosity.com/login", {userAgent: userAgent.replace(/heartbeam.* /, '').replace(/Electron.* /, '')});
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

ipcMain.handle('get-paced-breathing-days', () => {
  return getPacedBreathingDays();
});

/**
 * Stage 2 is complete when either (a) the user has done six Lumosity sessions and
 * at least two rest breathing sessions, or
 * (b) when the user has done four or five Lumosity sessions and at least two rest
 * breathing sessions AND at least six calendar days have passed since the first Lumosity session.
 * @returns {object} {complete: true|false, completedOn: yyyymmdd string 
 * representing the latest of the date the rest breathing or the lumosity days were
 * completed, or null if complete is false}
 */
 async function stage2Complete(session) {
  const restBreathingDays = getRestBreathingDays();
  if (restBreathingDays.size < 3) return { complete: false, completedOn: null }; // spec calls for minimum 2, but they do 1 during setup that doesn't count for this

  const apiClient = new ApiClient(session);
  const data = await apiClient.getSelf();
  if (!data.lumosDays || data.lumosDays.length === 0) return { complete: false, completedOn: null };

  const lumosDaysSet = new Set(data.lumosDays);
  if (lumosDaysSet.size <= 3) return { complete: false, completedOn: null };

  const lumosDaysArr = new Array(...lumosDaysSet).map(x => parseInt(x));
  lumosDaysArr.sort((a, b) => a - b);
  const firstLumosDay = lumosDaysArr[0].toString();
  const lumosStartDate = new Date(firstLumosDay.substring(0,4), parseInt(firstLumosDay.substring(4,6))-1, firstLumosDay.substring(6,8));
  
  const now = new Date();
  const diffMs = now - lumosStartDate;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays >= 6 || lumosDaysSet.size >= 6) {
    const completedOn = calculateStage2CompletionDate(lumosDaysArr, lumosStartDate, new Array(...restBreathingDays).slice(1)); // drop first rest breathing day b/c it's from setup (stage 1)
    return { complete: true, completedOn: completedOn }
  } else {
    return { complete: false, completedOn: null }
  }
}

/**
 * Finds the earliest possible date someone completed stage 2. This could be:
 *  - the date of their sixth Lumosity session
 *  - the date of their second breathing session
 *  - six days after start of first Lumosity session (if 4-5 sessions have been done)
 *  - the date of the fourth Lumosity session (if it's at least six days after the first Lumosity session)
 * Throws an error if the stage is not actually complete.
 * @param {Array} lumosDays yyyymmdd dates of Lumosity sessions
 * @param {Date} lumosStartDate the date of the first Lumosity session
 * @param {Array} restBreathingDays yyyymmdd dates of rest breathing sessions
 * @returns yyyymmdd date representing the date stage 2 was completed
 */
function calculateStage2CompletionDate(lumosDays, lumosStartDate, restBreathingDays) {
  if (lumosDays.length < 4) throw new Error(`Expected at least four Lumosity sessions but found ${lumosDays.length}. Stage 2 is not complete.`)
  if (restBreathingDays.length < 2) throw new Error(`Expected at least two rest breathing sessions but found ${restBreathingDays.length}. Stage 2 is not complete.`)
  const fourthLumos = lumosDays[3];
  const sixthLumos = lumosDays.length >= 6 ? lumosDays[5] : Number.MAX_SAFE_INTEGER;
  const sixDays = new Date(lumosStartDate.getTime() + (1000 * 60 * 60 * 24 * 6));
  const sixDaysYMD = yyyymmddNumber(sixDays);
  const secondBreathing = restBreathingDays[1];
  const earliestLumosEnd = Math.max(fourthLumos, sixDaysYMD)
  const lumosEnd = Math.min(earliestLumosEnd, sixthLumos)
  return Math.max(lumosEnd, secondBreathing);
}

ipcMain.on('is-stage-2-complete', async(_event, session) => {
  const res = await stage2Complete(SessionStore.buildSession(session))
  _event.returnValue = res
})

async function stage1Complete() {
  const restBreathingDays = getRestBreathingDays();
  if (restBreathingDays.size < 1) return { complete: false, completedOn: null };

  const pacedBreathingDays = getPacedBreathingDays();
  if (pacedBreathingDays.size < 1) return { complete: false, completedOn: null };

  return { complete: true, completedOn: Math.max(restBreathingDays[0], pacedBreathingDays[0]).toString() };
}

ipcMain.on('is-stage-1-complete', async(_event) => {
  const res = await stage1Complete();
  _event.returnValue = res;
});

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
