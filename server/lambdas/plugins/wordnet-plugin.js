'use strict';

const fs = require('fs');

const wordNetFiles = ['wn3.1-adjs3.txt', 'wn3.1-adjs4.txt', 'wn3.1-nouns3.txt', 'wn3.1-nouns4.txt'];

class WordNetPlugin {
  constructor() {
    this.hooks = {
        'after:webpack:package:packExternalModules': () => this.copyWordNetFiles()
    }
  }

  copyWordNetFiles() {
    wordNetFiles.forEach(f => {
        // these paths are set by the config in serverless.yml and the sls-webpack plugin
        fs.copyFileSync(`./on-user-verify/${f}`, `.webpack/write-user-on-verify/on-user-verify/${f}`);
    });
  }
}
 
module.exports = WordNetPlugin;