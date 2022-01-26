const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const webpack = require("webpack");

module.exports = {
    entry: {
        login: 'login/login.js',
        logout: 'logout/logout.js',
        'daily-tasks': 'daily-tasks/daily-tasks.js'
    },
    plugins: [
        // here to quiet complaint about process.env not existing when util lib is loaded
        // by logger
        new webpack.DefinePlugin({
            'process.env': JSON.stringify({'NODE_DEBUG': false})
        }),
        new HtmlWebpackPlugin({
            title: 'HeartBEAM Login',
            template: 'login/index.ejs',
            filename: 'login/index.html',
            chunks: ['login']
        }),
        new HtmlWebpackPlugin({
            title: 'Daily Tasks',
            filename: 'daily-tasks/index.html',
            chunks: ['daily-tasks']
        }),
        new HtmlWebpackPlugin({
            title: 'HeartBEAM Logout',
            filename: 'logout/index.html',
            chunks: ['logout']
        }),
        new HtmlWebpackPlugin({
            title: 'HeartBEAM Logout',
            filename: 'logout/success/index.html',
            chunks: ['logout']
        }),
        new HtmlWebpackPlugin({
            title: 'HeartBEAM Logout',
            filename: 'logout/error/index.html',
            chunks: ['logout']
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
            {
                exclude: [path.join(__dirname, "scripts")]
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
    }
};
