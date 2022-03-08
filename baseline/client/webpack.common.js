const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const webpack = require("webpack");

module.exports = {
    entry: {
        'admin/dashboard': 'admin/dashboard/index.js',
        'admin/download': 'admin/download/download.js',
        'daily-tasks': 'daily-tasks/daily-tasks.js',
        'login': 'login/login.js',
        'logout': 'logout/logout.js',
    },
    plugins: [
        // here to quiet complaint about process.env not existing when util lib is loaded
        // by logger
        new webpack.DefinePlugin({
            'process.env': JSON.stringify({'NODE_DEBUG': false}),
        }),
        new HtmlWebpackPlugin({
            title: 'Admin - Dashboard',
            filename: 'admin/dashboard/index.html',
            template: 'admin/dashboard/index.ejs',
            chunks: ['admin/dashboard'],
        }),
        new HtmlWebpackPlugin({
            title: 'Admin - Download',
            filename: 'admin/download/index.html',
            template: 'admin/download/index.ejs',
            chunks: ['admin/download'],
        }),
        new HtmlWebpackPlugin({
            title: 'Daily Tasks',
            filename: 'daily-tasks/index.html',
            chunks: ['daily-tasks'],
        }),
        new HtmlWebpackPlugin({
            title: 'HeartBEAM Login',
            filename: 'login/index.html',
            template: 'login/index.ejs',
            chunks: ['login'],
        }),
        new HtmlWebpackPlugin({
            title: 'HeartBEAM Logout',
            filename: 'logout/index.html',
            chunks: ['logout'],
        }),
        new HtmlWebpackPlugin({
            title: 'HeartBEAM Logout',
            filename: 'logout/success/index.html',
            chunks: ['logout'],
        }),
        new HtmlWebpackPlugin({
            title: 'HeartBEAM Logout',
            filename: 'logout/error/index.html',
            chunks: ['logout'],
        }),
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
            {
                exclude: [path.join(__dirname, "scripts")],
            }
        ],
    },
    resolve: {
        modules: [
            __dirname,
            path.join(__dirname, "node_modules"),
            path.join(__dirname, "../..", "common/auth/node_modules"),
            path.join(__dirname, "../..", "common/db/node_modules"),
            path.join(__dirname, "../..", "common/logger/node_modules"),
        ],
    },
};
