const net = require('net');
const { spawn } = require('child_process');
const CBuffer = require('CBuffer');

let emWaveProc = null;
const client = net.Socket();
const artifactLimit = 60; // we alert if there are more than this many artifacts in 60s
const artifactsToTrack = 120; // we get data every 500ms, so this holds 60s of data
let artifacts = new CBuffer(artifactsToTrack);
let reportSessionEnd = true;
const subscribers = [];

// sample data string
// <D01 NAME="Pat" LVL="1" SSTAT="2" STIME="2000" S="0" AS="0" EP="0" IBI="1051" ART="FALSE" HR="0" />
// sample real (not interpolated) ibi string
// <IBI> 1139 </IBI>
// sample session ended string
// <CMD ID="3" FROM="::ffff:127.0.0.1:APP" />
function parseIBIData(data) {
    const allDataRegex = /<D01.* STIME="([0-9]+)" .*EP="([0-9]+)" .*IBI="([0-9]+)" ART="(TRUE|FALSE)"/;
    const match = data.match(allDataRegex);
    if (match && match[1] !== "0") { // STIME of 0 means that the there isn't actually an emWave session; ignore those data
        return {stime: match[1], ep: match[2], ibi: match[3], ibiType: 'interpolated', artifact: match[4] === 'TRUE' ? true : false};
    } 
    
    const ibiRegex = /<IBI> ([0-9]+) <\/IBI>/;
    const match2 = data.match(ibiRegex);
    if (match2) {
        return {ibi: match2[1], ibiType: 'real'}
    }

    if (data.match(/<CMD ID="3" FROM="::ffff:127.0.0.1:APP"/)) {
        if (reportSessionEnd) {
            return 'SessionEnded';
        } else {
            reportSessionEnd = true;
            return null;
        }
    }
        
    return null;
}

export default {
    async createClient(win) {
        let retries = 0;
    
        client.on('error', async function() {
            if (retries > 0) console.log('network error') // we always get error on 1st try; don't log unless we are past that
            retries++;
            if (retries < 4) {
                await new Promise(r => setTimeout(r, 2000));
                if (retries > 1) console.log(`doing retry #${retries}`);
                client.connect(20480, '127.0.0.1', function() {
                    win.webContents.send('emwave-status', 'Connected');
                });	
            }
        });
    
        client.on('data', function(data) {
            const hrData = parseIBIData(new Buffer.from(data).toString());
            if (hrData === 'SessionEnded' ) {
                win.webContents.send('emwave-status', 'SessionEnded');
            } else if (hrData !== null) {
                win.webContents.send('emwave-ibi', hrData);
                subscribers.forEach(callback => callback(hrData));
                if (hrData.hasOwnProperty('artifact')) {
                    artifacts.push(hrData.artifact);
                    let artCount = 0;
                    artifacts.forEach(isArtifact => {
                        if (isArtifact) artCount++
                    });
                    if (artCount > artifactLimit) {
                        win.webContents.send('emwave-status', 'SensorError');
                    }
                }
            }
        });
    
        client.connect(20480, '127.0.0.1', function() {
            win.webContents.send('emwave-status', 'Connected');
        });	
    
        return client;
    },

    startEmWave() {
        // must set stdio: 'ignore' on spawn options
        // otherwise the stdout buffer will overflow after ~30s of pulse sensor data
        // and emWave will hang
        if (process.platform === 'darwin') {
            emWaveProc = spawn('/Applications/emWave Pro.app/Contents/MacOS/emWaveMac', [], {stdio: 'ignore'})
        } else if (process.platform === 'win32') {
            emWaveProc = spawn('C:\\Program Files (x86)\\HeartMath\\emWave\\emWavePC.exe', [], {stdio: 'ignore'})
        } else {
            throw `The '${process.platform}' operating system is not supported. Please use either Macintosh OS X or Windows.`
        }
        emWaveProc.on('close', (code) => {
            console.log(`emWave closed with code ${code}`);
        });
        console.log(`emwave pid is ${emWaveProc.pid}`);
    },

    startPulseSensor() {
        client.write('<CMD ID=2 />'); // tells emWave to start getting data from heartbeat sensor
        artifacts = new CBuffer(artifactsToTrack);
    },

    stopPulseSensor() {
        reportSessionEnd = false; // we're ending the session, not emWave, so don't tell our listeners about it
        client.write('<CMD ID=3 />'); // tells emWave to stop getting data from heartbeat sensor
    },

    stopEmWave() {
        client.destroy();
        if (emWaveProc !== null) {
            if (emWaveProc.kill()) {
                emWaveProc = null;
            } else {
                // TODO put in some wait/retry logic?
                console.log('killing emwave returned false');
            }
        }
    },

    subscribe(callback) {
        subscribers.push(callback);
    }
}

