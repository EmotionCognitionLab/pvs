const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = {
    entry: {},
    plugins: [],
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
                test: /\.(png|svg|jpg|jpeg|gif|wav|ogg)$/i,
                type: 'asset/resource',
            },
        ],
    },
    resolve: {
        modules: [
            __dirname,
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

add_page("verbal-learning", "verbal-learning/verbal-learning.js", "Verbal Learning Task");
add_page("flanker", "flanker/flanker.js", "Flanker Task");
add_page("verbal-fluency", "verbal-fluency/verbal-fluency.js", "Verbal Fluency Task");
add_page("panas", "panas/panas.js", "PANAS Questionnaire");
add_page("daily-stressors", "daily-stressors/daily-stressors.js", "Daily Stressors Questionnaire");
add_page("mood-prediction", "mood-prediction/mood-prediction.js", "Mood Prediction Questionnaire");
add_page("mood-memory", "mood-memory/mood-memory.js", "Mood Memory Questionnaire");