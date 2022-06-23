'use strict'

import { app, protocol, BrowserWindow, BrowserView, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
const isDevelopment = process.env.NODE_ENV !== 'production'
import emwave from './emwave'
import s3Utils from './s3utils.js'
import { emWaveDbPath, deleteShortSessions as deleteShortEmwaveSessions } from './emwave-data'
import { forTesting, breathDbPath, closeBreathDb, getAvgRestCoherence } from './breath-data'
import { getRegimesForSession } from './regimes'
import path from 'path'
const AmazonCognitoIdentity = require('amazon-cognito-auth-js')
import awsSettings from '../../common/aws-settings.json'
import { Logger } from '../../common/logger/logger.js'
import { SessionStore } from './session-store.js'
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
  forTesting.initBreathDb()
  mainWin = await createWindow()
  emwave.createClient(mainWin)
  emwave.hideEmWave()
  new Logger()
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection: ', promise, 'reason: ', reason)
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

ipcMain.on('create-lumosity-view', (_event, email, password) => {
    if (!mainWin || lumosityView) {
        return;
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
    lumosityView.setBounds({x: 0, y: 50, width: 1284, height: 593});  // hardcoded!!!
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

ipcMain.handle('quit', () => {
  app.quit();
});

ipcMain.handle('avg-rest-coherence', () => {
  return getAvgRestCoherence();
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
