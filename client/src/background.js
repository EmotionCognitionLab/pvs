'use strict'

import { app, protocol, BrowserWindow, BrowserView, ipcMain, Menu } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import unhandled from 'electron-unhandled'
const isDevelopment = process.env.NODE_ENV !== 'production'
import emwave from './emwave'
import s3Utils from './s3utils.js'
import { yyyymmddNumber, yyyymmddString } from './utils'
import { emWaveDbPath, deleteShortSessions as deleteShortEmwaveSessions } from './emwave-data'
import { breathDbPath, closeBreathDb, getRestBreathingDays, getPacedBreathingDays, getSegmentsAfterDate, getLastShownDateTimeForBonusType, setLastShownDateTimeForBonusType } from './breath-data'
import { getRegimesForSession, getRegimesForVisit4 } from './regimes'
import path from 'path'
const AmazonCognitoIdentity = require('amazon-cognito-auth-js')
import awsSettings from '../../common/aws-settings.json'
import { Logger } from '../../common/logger/logger.js'
import { SessionStore } from './session-store.js'
import ApiClient from '../../common/api/client.js'
import version from "../version.json";
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

app.setAboutPanelOptions({
  applicationName: "HeartBEAM",
  applicationVersion: version.v,
  iconPath: asssetsPath() + "logo.png"
})

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

const EARNINGS_MENU_ID = 'earnings'
const TRAINING_MENU_ID = 'training'
const LAB_VISIT_MENU_ID = 'lab-visit'

function buildMenuTemplate(window) {
  const isMac = process.platform === 'darwin'
  const isDev = isDevelopment && !process.env.IS_TEST

  return [
    // { role: 'appMenu' }
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // { role: 'fileMenu' }
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [ ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Earnings', id: EARNINGS_MENU_ID, click: () => window.webContents.send('show-earnings')},
        { label: 'Daily Training', id: TRAINING_MENU_ID, click: () => window.webContents.send('show-tasks')},
        { label: 'Lab Visit 4', id: LAB_VISIT_MENU_ID, click: () => window.webContents.send('show-visit-4'), visible: false, accelerator: 'CmdOrCtrl+Shift+L'}
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    // { role: 'helpMenu' }
    ...(isMac ? [] : [{
      label: 'Help',
      submenu: [{role: 'about'}]
    }])
  ]
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

function asssetsPath() {
  if (process.env.NODE_ENV === 'production') {
    if (process.platform === 'darwin') {
      return path.join(path.dirname(app.getPath('exe')), '../src/assets/')
    }
    return path.join(path.dirname(app.getPath('exe')), '/src/assets/')
  } else {
    return path.join(app.getAppPath(), '../src/assets/')
  }
}

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

  // register protocol to handle image loading
  protocol.registerFileProtocol('image', (req, callback) => {
    const prefix = asssetsPath();
    const url = req.url.replace('image://', prefix)
    try {
      return callback(url)
    } catch (err) {
      console.error(`Failed to load image ${req.url}`, err)
      return callback(404)
    }
  })

  await emwave.startEmWave()

  // give emwave some time to start,
  // them create window and menus
  setTimeout(async () => {
    mainWin = await createWindow()
    const menuTmpl = buildMenuTemplate(mainWin)
    const menu = Menu.buildFromTemplate(menuTmpl)
    Menu.setApplicationMenu(menu)
    mainWin.webContents.on('did-finish-load', () => {
      mainWin.webContents.send('get-current-user')
    })
    emwave.createClient(mainWin)
    mainWin.setFullScreen(true)
    mainWin.show()
    emwave.hideEmWave()
  }, 5000)
})

ipcMain.handle('disable-menus', () => {
  const m = Menu.getApplicationMenu()
  m.getMenuItemById(EARNINGS_MENU_ID).enabled = false
  m.getMenuItemById(TRAINING_MENU_ID).enabled = false
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
        // #323 skipping past lumosity might cause the lumosity view to be
        // removed before the login can be executed
        if (lumosityView && lumosityView.webContents) {
          lumosityView.webContents.executeJavaScript(lumosityLoginJS(email, password));
        }
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
  // give emWave a couple of seconds to save any lingering data before quitting
  await new Promise(resolve => setTimeout(() => {
    emwave.stopEmWave();
    resolve();
  }, 2000));
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

ipcMain.handle('regimes-for-session', (_event, subjCondition, stage) => {
  return getRegimesForSession(subjCondition, stage);
});

ipcMain.handle('regimes-for-visit-4', (_event, subjCondition, stage) => {
  return getRegimesForVisit4(subjCondition, stage);
})

ipcMain.handle('get-rest-breathing-days', (_event, stage) => {
  return getRestBreathingDays(stage);
});

ipcMain.handle('get-paced-breathing-days', (_event, stage) => {
  return getPacedBreathingDays(stage);
});

ipcMain.handle('get-segments-after-date', (_event, date, stage) => {
  return getSegmentsAfterDate(date, stage);
});

async function stage1Complete() {
  const restBreathingDays = getRestBreathingDays(1);
  if (restBreathingDays.size < 1) return { complete: false, completedOn: null };

  const pacedBreathingDays = getPacedBreathingDays(1);
  if (pacedBreathingDays.size < 1) return { complete: false, completedOn: null };

  return { complete: true, completedOn: Math.max([...restBreathingDays][0], [...pacedBreathingDays][0]).toString() };
}

ipcMain.handle('is-stage-1-complete', async(_event) => {
  const res = await stage1Complete();
  return res;
});

ipcMain.handle('set-stage', async(_event, stage) => {
  emwave.setStage(stage);
});

ipcMain.handle('paced-breathing-days', (_event, stage) => {
  return getPacedBreathingDays(stage);
});

ipcMain.handle('get-last-shown-date-time-for-bonus-type', (_event, bonusType) => {
  return getLastShownDateTimeForBonusType(bonusType);
});

ipcMain.handle('set-last-shown-date-time-for-bonus-type', (_event, bonusType, lastShownDateTime) => {
  return setLastShownDateTimeForBonusType(bonusType, lastShownDateTime);
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
