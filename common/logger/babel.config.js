module.exports = {
    plugins: ['@babel/plugin-transform-regenerator'],
    presets: ['@babel/preset-env'],
    env: {
        'test': {
            'presets': [
                ['@babel/preset-env', { 'targets': { 'node': 'current' } }]
            ]
        }
    }
}