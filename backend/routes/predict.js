const express = require("express");
const axios = require("axios");

const router = express.Router();

// Python ML service URL
const ML_API_URL = "http://localhost:8000/predict";

router.post("/predict-district", async (req, res) => {
  try {
    const response = await axios.post(ML_API_URL, req.body);
    res.json(response.data);
  } catch (error) {
    console.error("ML service error:", error.message);
    res.status(500).json({ error: "ML prediction failed" });
  }
});

module.exports = router;
