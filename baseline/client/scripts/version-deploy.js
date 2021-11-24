'use strict';

/** 
 * Usage: version-deploy.js
 * 
 * Asks what the next version number should be and writes it to version.json.
*/

const { spawnSync } = require('child_process');
const fs = require('fs');
const prompt = require('prompt');
// Turn off some defaults in the prompt framework
prompt.message = '';
prompt.delimiter = '';

const versionFile = 'version.json';

function getCurGitVersion() {
    const git = spawnSync('git', ['tag', '-l', '--sort=v:refname', '[0-9]*']);
    if (git.stdout.toString() === '') return '0.0.0';
    return git.stdout.toString().split('\n').filter(f => f !== '').pop();
}

function incrementVersion(curVersion, whichPart) {
    if (whichPart !== 'major' && whichPart !== 'minor' && whichPart !== 'patch') throw new Error(`Expected one of 'major', 'minor' or 'patch', but got ${whichPart}.`);

    const parts = curVersion.split('.');
    if (parts.length !== 3) throw new Error(`Expected current version to be in the form X.Y.Z, but got ${curVersion}`);

    if (whichPart === 'major') {
        return `${+parts[0] + 1}.0.0`;
    }
    if (whichPart === 'minor') {
        return `${parts[0]}.${+parts[1] + 1}.0`;
    }
    if (whichPart === 'patch') {
        return `${parts[0]}.${parts[1]}.${+parts[2] + 1}`;
    }
}

function requestVersion(curVersion, suggestedVersion) {
    const schema = {
        properties: {
            version: {
                conform: function(v) {
                    // TODO check that it's not lower than the current version
                    if (v === curVersion) return false;
                    if (!/[0-9]+\.[0-9]+\.[0-9]+/.test(v)) return false;
                    return true;
                },
                message: 'You must provide a valid version of the form X.Y.Z (different from the current version)',
                description: `Next version [${suggestedVersion}]:`,
                required: false
            }
        }
    };
    return new Promise((resolve, reject) => {
        prompt.get(schema, function(err, result) {
            if (err) {
                reject(err);
            } else {
                if (result.version === '') {
                    resolve(suggestedVersion);
                } else {
                    resolve(result.version);
                }
            }
        });
    });       
}

function writeVersionFile(version, targetFile) {
    return new Promise((resolve, reject) => {
        fs.writeFile(targetFile, JSON.stringify(version), err => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

const curGitVersion = getCurGitVersion();
const patch = incrementVersion(curGitVersion, 'patch');
console.log(`Current git version is ${curGitVersion}`);
requestVersion(curGitVersion, patch)
.then(newGitVersion => writeVersionFile({v: newGitVersion}, versionFile))
.catch(err => {
    console.log(err);
    process.exit(1);
});
