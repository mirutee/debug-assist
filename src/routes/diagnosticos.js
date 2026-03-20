// src/routes/diagnosticos.js
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");

router.post("/", auth, validate, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
