const net = require('net');
const { spawn } = require('child_process');

let emWaveProc = null;
const client = net.Socket();

function parseIBIData(data) {
    const ibiRegex = /.*IBI="([0-9]+).*"/;
    const match = data.match(ibiRegex);
    if (match) {
        return match[1];
    } else {
        return null;
    }
}

export default {
    async createClient(win) {
        let retries = 0;
    
        client.on('error', async function() {
            console.log('network error')
            retries++;
            if (retries < 4) {
                await new Promise(r => setTimeout(r, 2000));
                console.log(`doing retry #${retries}`);
                client.connect(20480, '127.0.0.1', function() {
                    win.webContents.send('emwave-status', 'Connected');
                });	
            }
        });
    
        client.on('data', function(data) {
            const ibiStr = parseIBIData(new Buffer.from(data).toString());
            if (ibiStr !== null) {
                win.webContents.send('emwave-ibi', ibiStr);
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
    },

    stopPulseSensor() {
        client.write('<CMD ID=3 />'); // tells emWave to stop getting data from heartbeat sensor
    },

    stopEmWave() {
        client.destroy();
        if (emWaveProc !== null) {
            console.log('emwaveProc is not null');
            if (emWaveProc.kill()) {
                console.log('killed emwave');
                emWaveProc = null;
            } else {
                // TODO put in some wait/retry logic?
                console.log('killing emwave returned false');
            }
        }
    }
}

