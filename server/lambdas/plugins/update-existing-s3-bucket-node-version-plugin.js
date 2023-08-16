// See https://github.com/serverless/serverless/issues/11337

'use strict';

class LambdaUpdateDeprecatedRuntime {

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = 'aws';

    this.hooks = {
      'after:deploy:compileEvents': this.afterCompileEvents.bind(this),
    };
  }

  afterCompileEvents() {
    let key = 'CustomDashresourceDashexistingDashs3LambdaFunction'
    let resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;
    if (key in resources && resources[key].Properties.Runtime == 'nodejs12.x') {
      this.serverless.cli.log("Fixed CustomDashresourceDashexistingDashs3LambdaFunction runtime from `nodejs12.x` to `nodejs14.x`");
      resources[key].Properties.Runtime = 'nodejs14.x'
    }
  }
}

module.exports = LambdaUpdateDeprecatedRuntime;