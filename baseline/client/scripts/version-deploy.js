'use strict';

/** 
 * Usage: version-deploy.js
 * 
 * Does the following:
 *  1. Asks what the next tagged git version should be.
 *  2. Writes new version to version.json.
 *  3. Calls git tag -a <new version> to tag it.
 *  4. Optionally pushes new version to remote repo.
*/

const { spawnSync } = require('child_process');

const prompt = require('prompt');
// Turn off some defaults in the prompt framework
prompt.message = '';
prompt.delimiter = '';

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

function requestYesNo(msg) {
    const schema = {
        properties: {
            continue: {
                pattern: /[yYnN]/,
                message: 'Please answer Y (yes) or N (no):',
                description: msg,
                required: true
            }
        }
    };
    return new Promise((resolve, reject) => {
        prompt.get(schema, function(err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result.continue);
            }
        });
    });
}


const curGitVersion = getCurGitVersion();
const patch = incrementVersion(curGitVersion, 'patch');
console.log(`Current git version is ${curGitVersion}`);
requestVersion(curGitVersion, patch)
.then(newGitVersion => {
    const gitTag = spawnSync('git', ['tag', '-a', newGitVersion, '-m', `Bumping to version ${newGitVersion}`]);
    if (gitTag.status !== 0 || gitTag.error) {
        const gitTagErr = `git tag exited with status ${gitTag.status}`;
        console.log(gitTag.stderr.toString());
        if (gitTag.error) {
            throw gitTag.error;
        } else {
            throw new Error(gitTagErr);
        }
    }
})
.then(() => {
    return requestYesNo('Push new version tag to remote repository? (Y/N):');
})
.then(answer => {
    if (answer.toUpperCase() === 'Y') {
        const gitPush = spawnSync('git', ['push', '--tags'], {stdio: 'inherit'}); // TODO decide what to do about branches
        if (gitPush.status !== 0 || gitPush.error) {
            const gitPushErr = `git push exited with status ${gitPush.status}`;
            console.log(gitPush.stderr);
            if (gitPush.error) {
                throw gitPush.error;
            } else {
                throw new Error(gitPushErr);
            }
        }
    }
})
.catch(err => {
    console.log(err);
    process.exit(1);
});







