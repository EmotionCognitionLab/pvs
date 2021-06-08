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
    externals: {
		'amazon-cognito-auth-js': {
			commonjs: 'amazon-cognito-auth-js',
			commonjs2: 'amazon-cognito-auth-js',
			amd: 'amazon-cognito-auth-js',
			root: 'AmazonCognitoAuth',
		}
    },
    mode: "development"
};