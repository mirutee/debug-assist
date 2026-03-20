// src/app.js
require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

app.use("/health", require("./routes/health"));
app.use("/v1/diagnosticos", require("./routes/diagnosticos"));

module.exports = app;
