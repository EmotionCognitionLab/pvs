'use strict';

/**
 * Checks to make sure that the following are true. Exits with non-zero exit code if any are false:
 * 
 *  * There are no untracked files in the current directory hierarchy
 *  * There are no uncommitted files in the current directory hierarchy
 *  * There are no staged but unpushed commits
 *  * All of the values in aws-settings are approprite for the target deployment environment.
 * 
 * Usage: node pre-deploy.js [target env]
 * ...where [target env] is most likely 'dev' or 'prod'.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const deployableBranches = ['prod'];

const settingsFiles = {
    'dev': '../../../common/aws-settings.dev.json',
    'prod': '../../../common/aws-settings.prod.json',
    'deploy': '../../../common/aws-settings.json'
};

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

function branchOk() {
    const branch = getBranch();
    return deployableBranches.includes(branch);
}

function envSettingsOk(env) {
    const envFile = settingsFiles[env];
    if (!envFile) {
        throw new Error(`No settings file found for ${env}.`);
    }
    const diff = spawnSync('diff', [path.join(__dirname, envFile), path.join(__dirname, settingsFiles['deploy'])]);
    return diff.stdout.toString().length === 0 && diff.stderr.toString().length === 0;
}

function main() {
    const uncommitted = getUncommittedFiles();
    if (uncommitted.length !== 0 && uncommitted[0] !== '') {
        console.log(`Found uncommitted files. Please remove or commit before deploying:\n ${uncommitted.join(", ")}`);
        process.exit(1);
    }

    const unpushed = getUnpushedFiles();
    if (unpushed.length !== 0) {
        console.log(`Unpushed commits exist. Please push before deploying.`);
        process.exit(2);
    }

    if (!envSettingsOk(process.argv[2])) {
        console.log(`The settings in ${settingsFiles['deploy']} are not as expected for deploying to ${process.argv[2]}. Deployment halted.`);
        process.exit(3);
    }

    if (!branchOk()) {
        const curBranch = getBranch();
        console.log(`You are on brawnch ${curBranch}, which is not a permitted deployment branch.\nPlease make sure that what you want to deploy is on a deployment branch and switch to it.`);
        process.exit(4);
    }

    process.exit(0);
}

main();
