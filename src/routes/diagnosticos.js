// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

router.post("/", auth, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
