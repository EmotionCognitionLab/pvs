const path = require('path');

module.exports = {
    entry: ['./src/db.js'],
    output: {
		filename: 'db.js',
		path: path.resolve(__dirname, 'dist'),
		library: {
			name: 'db',
			type: 'umd',
		},
    },
    mode: "development"
};