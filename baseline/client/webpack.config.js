const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const webpack = require("webpack");

module.exports = {
    entry: {},
    plugins: [
        // here to quiet complaint about process.env not existing when util lib is loaded
        // by logger
        new webpack.DefinePlugin({
            'process.env': JSON.stringify({'NODE_DEBUG': false})
        })
    ],
    optimization: {
        splitChunks: {
            chunks: "all",
        },
    },
    module: {
        rules: [
            {
                test: /\.html$/i,
                loader: "html-loader",
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif|wav|ogg|mp3)$/i,
                type: 'asset/resource',
            },
        ],
    },
    resolve: {
        modules: [
            __dirname,
            path.join(__dirname, "node_modules"),
            path.join(__dirname, "../..", "common/auth/node_modules"),
            path.join(__dirname, "../..", "common/db/node_moduless")
        ],
    },
    output: {
        path: path.join(__dirname, "dist"),
    },
    devServer: {
        contentBase: path.join(__dirname, "dist"),
        compress: true,
        port: 9000,
    },
    mode: "development",
};

module.exports.entry['login'] = {
    import: 'login/login.js',
    filename: 'login/login.bundle.js'
}

module.exports.plugins.push(new HtmlWebpackPlugin({
    title: 'HeartBEAM Login',
    template: 'login/index.ejs',
    filename: 'login/index.html',
    chunks: ['login']
}));

module.exports.entry['daily-tasks'] = {
    import: 'daily-tasks/daily-tasks.js',
    filename: 'daily-tasks/daily-tasks.bundle.js'
}

module.exports.plugins.push(new HtmlWebpackPlugin({
    title: 'Daily Tasks',
    filename: 'daily-tasks/index.html',
    chunks: ['daily-tasks']
}));