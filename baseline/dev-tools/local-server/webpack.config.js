const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

const client = path.join(__dirname, "../../client");

module.exports = {
    entry: {
        flanker: {
            import: path.join(client, "flanker/flanker.js"),
            filename: "flanker/flanker.bundle.js",
        },
        panas: {
            import: path.join(client, "panas/panas.js"),
            filename: "panas/panas.bundle.js",
        },
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "Flanker Task",
            filename: "flanker/index.html",
            chunks: ["flanker"],
        }),
        new HtmlWebpackPlugin({
            title: "PANAS Questionnaire",
            filename: "panas/index.html",
            chunks: ["panas"],
        }),
        new HtmlWebpackPlugin({
            filename: "index.html",
            template: path.join(__dirname, "public/index.html"),
            chunks: [],
        }),
    ],
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
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
        ],
    },
    resolve: {
        modules: [
            client,
            path.join(__dirname, "node_modules")
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
