const path = require("path")

module.exports = {
  entry: path.resolve(__dirname, "pay-info.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "payinfo.bundle.js",
    library: {
        name: "payInfo",
        type: "umd"
    },
  },
  module: {
    rules: [
        {
            test: /\.(js)$/,
            exclude: /node_modules/,
            use: "babel-loader",
        },
        {
            test: /\.html$/i,
            loader: "html-loader",
        },
        { 
          test: /\.handlebars$/, 
          loader: "handlebars-loader" 
        }
    ],
  },
  mode: "production",
}