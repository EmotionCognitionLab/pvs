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