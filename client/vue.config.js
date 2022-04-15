module.exports = {
  configureWebpack: config => {
    config.externals = {
        'better-sqlite3': 'commonjs better-sqlite3'
    };
  },
  pluginOptions: {
    electronBuilder: {
      nodeIntegration: true,
      preload: 'src/preload.js',
      externals: [ 'better-sqlite3' ]
    }
  }
}