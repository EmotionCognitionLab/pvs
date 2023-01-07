const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const prompt = require('prompt');
const { version } = require('os');
// Turn off some defaults in the prompt framework
prompt.message = '';
prompt.delimiter = '';

function getUncommittedFiles() {
    const git = spawnSync('git', ['ls-files', '--modified', '--other', '--exclude-standard']);
    return git.stdout.toString().split('\n');
}

function getUnpushedFiles() {
    const git = spawnSync('git', ['rev-list', 'HEAD', '^origin']);
    return git.stdout.toString();
}

function getBranch() {
    const git = spawnSync('git', ['branch', '--show-current']);
    return git.stdout.toString().trimEnd();
}

function branchOk(deployableBranches) {
    const branch = getBranch();
    return deployableBranches.includes(branch);
}

/**
 * 
 * @param {string} env The target you're deploying to - dev, qa, prod, etc.
 * @param {Object} envConfigFileMap An object that maps target to config file. Must contain the key "deploy"/value config file used in deployment.
 * @returns 
 */
function envSettingsOk(env, envConfigFileMap) {
    const envFile = envConfigFileMap[env];
    if (!envFile) {
        throw new Error(`No settings file found for ${env}.`);
    }
    const diff = spawnSync('diff', [path.join(__dirname, envFile), path.join(__dirname, envConfigFileMap['deploy'])]);
    return diff.stdout.toString().length === 0 && diff.stderr.toString().length === 0;
}

/**
 * Checks git for the latest tag starting with prefix.
 * @param {string} prefix The prefix for the type of version tag you're interested in, e.g. "base-app-". Can be a limited regex, e.g. "[0-9]*" to limit it to tags that start with numbers.
 * @returns 
 */
function getCurGitVersion(prefix) {
    const git = spawnSync('git', ['tag', '-l', '--sort=v:refname', prefix]);
    if (git.stdout.toString() === '') return '0.0.0';
    return git.stdout.toString().split('\n').filter(f => f !== '').pop();
}

function getCurVersionFromFile(versionFile) {
    const version = require(versionFile);
    return version.v;
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


function runWithErrorHandling(cmd, cmdArgs) {
    const result = spawnSync(cmd, cmdArgs);
    if (result.status !== 0 || result.error) {
        const errMsg = `${cmd} ${cmdArgs.join(' ')} exited with status ${result.status}`;
        console.log(result.stderr.toString());
        if (result.error) {
            throw result.error;
        } else {
            throw new Error(errMsg);
        }
    }
}

/**
 * Commits versionFile to git, reads version from it and creates git tag with that version.
 * @param {string} versionFile 
 */
function gitTagVersion(versionFile) {
    const curVersion = getCurVersionFromFile(versionFile);
    runWithErrorHandling('git', ['commit', '-m', `Updating baseline/client version to ${curVersion}`, versionFile]);
    runWithErrorHandling('git', ['tag', '-a', curVersion, '-m', `Bumping to version ${curVersion}`]);
}

module.exports = { 
    getBranch,
    getUncommittedFiles,
    getUnpushedFiles,
    branchOk,
    envSettingsOk,
    getCurGitVersion,
    getCurVersionFromFile,
    incrementVersion,
    requestVersion,
    writeVersionFile,
    gitTagVersion
}