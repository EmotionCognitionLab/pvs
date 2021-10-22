const path = require('path');
const webpack = require('webpack');

module.exports = {
    entry: './src/logger.js',
	plugins: [
		new webpack.ProvidePlugin({
			   process: 'process/browser',
		}),
	],
    output: {
		filename: 'logger.js',
		path: path.resolve(__dirname, 'dist'),
		library: {
			name: 'logger',
			type: 'umd',
		},
		globalObject: 'this'
    },
	resolve: {
		fallback: { "util": require.resolve("util/") }
	},
    mode: "development"
};
