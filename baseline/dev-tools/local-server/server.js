const express = require("express");
const logger = require("morgan");
const path = require("path");
const app = express();

app.use(logger('dev'));
app.use(express.static(path.join(__dirname, "../../client")));
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res, next) => {
    if (req.path == "/js/jspsych.js") {
        return res.sendFile(path.join(__dirname, "node_modules/@adp-psych/jspsych/jspsych.js"));
    }
    next();
});
app.use("/js", express.static(path.join(__dirname, "node_modules/@adp-psych/jspsych/plugins")));
app.use("/css", express.static(path.join(__dirname, "node_modules/@adp-psych/jspsych/css")));

app.listen(3000);
console.log("listening on port 3000...");
