const path = require('path');

module.exports = {
    entry: './src/auth.js',
    output: {
		filename: 'auth.js',
		path: path.resolve(__dirname, 'dist'),
		library: {
			name: 'auth',
			type: 'umd',
		},
    },
    mode: "development"
};
