const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

const client = path.join(__dirname, "../../client");

module.exports = {
    entry: {},
    plugins: [new HtmlWebpackPlugin({template: '../../client/index.ejs'})],
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
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            },
        ],
    },
    resolve: {
        modules: [
            client,
            path.join(__dirname, "node_modules"),
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

function add_page(name, impo, title) {
    // add entry point
    module.exports.entry[name] = {
        import: impo,
        filename: `${name}/${name}.bundle.js`,
    };
    // add HTML file
    module.exports.plugins.push(new HtmlWebpackPlugin({
        filename: `${name}/index.html`,
        chunks: [name],
        title: title,
    }));
}
add_page("flanker", "flanker/flanker.js", "Flanker Task");
add_page("verbal-fluency", "verbal-fluency/verbal-fluency.js", "Verbal Fluency Task");
add_page("panas", "panas/panas.js", "PANAS Questionnaire");
add_page("daily-stressors", "daily-stressors/daily-stressors.js", "Daily Stressors Questionnaire");
