'use strict';
const path = require('path');
const { preDeployCheckOK } = require('deploytools')
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
const deployableBranches = ['prod'];

const settingsFiles = {
    'dev': path.join(__dirname, '../../common/aws-settings.dev.json'),
    'prod': path.join(__dirname, '../../common/aws-settings.prod.json'),
    'deploy': path.join(__dirname, '../../common/aws-settings.json')
};

try {
    if (preDeployCheckOK(process.argv[2], settingsFiles, deployableBranches)) process.exit(0);
} catch (err) {
    console.error(err);
    process.exit(1);
}
 