const express = require("express");
const axios = require("axios");

const router = express.Router();

// Proxy district-wise ML prediction
router.post("/predict-district", async (req, res) => {
  try {
    const response = await axios.post(
      "http://localhost:8000/predict-district-wise",
    );
    res.json(response.data);
  } catch (err) {
    console.error("ML service error:", err.message);
    res.status(500).json({ error: "ML prediction failed" });
  }
});

module.exports = router;
