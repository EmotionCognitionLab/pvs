module.exports = {
    target: 'node',
    externals: [
      'better-sqlite3'
    ],
    module: {
        rules: [
            {
                test: /docusign-esign\/.*\.js$/,
                use: {
                  loader: 'imports-loader',
                  options: {
                    additionalCode: 'var define = false; /* Disable AMD for misbehaving libraries */',
                  },
                },
            }
        ]
    },
    mode: 'production'
};