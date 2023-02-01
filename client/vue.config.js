module.exports = {
  configureWebpack: config => {
    config.externals = {
        'better-sqlite3': 'commonjs better-sqlite3'
    };
  },
  pluginOptions: {
    electronBuilder: {
      builderOptions: {
        appId: "heartbeam",
        extraFiles: {
          from: 'src/powershell/start-emwave-hidden.ps1',
          to: 'start-emwave-hidden.ps1'
        },
        productName: "HeartBEAM",
        win: {
          icon: "HeartBEAM-icon.png"
        }
      },
      nodeIntegration: true,
      preload: 'src/preload.js',
      externals: [ 'better-sqlite3' ]
    }
  }
}