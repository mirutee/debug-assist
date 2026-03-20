// src/routes/diagnosticos.js (temporary stub — will be replaced in Task 3)
const express = require("express");
const router = express.Router();

router.post("/", (_req, res) => {
  res.status(501).json({ erro: "Not implemented yet" });
});

module.exports = router;
