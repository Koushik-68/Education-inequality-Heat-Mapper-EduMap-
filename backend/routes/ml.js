const express = require("express");
const axios = require("axios");

const router = express.Router();

// Python ML service base URL
const ML_BASE_URL = "http://127.0.0.1:8000";

// District-wise prediction
router.post("/predict-district-wise", async (req, res) => {
  try {
    const response = await axios.post(
      `${ML_BASE_URL}/predict-district-wise`,
      req.body || {},
    );
    res.json(response.data);
  } catch (error) {
    console.error("ML Service Error:", error.message);
    res.status(500).json({ error: "ML service unavailable" });
  }
});

// Single prediction (optional)
router.post("/predict", async (req, res) => {
  try {
    const response = await axios.post(`${ML_BASE_URL}/predict`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error("ML Service Error:", error.message);
    res.status(500).json({ error: "ML service unavailable" });
  }
});

// Explanation (SHAP) for single payload
router.post("/explain", async (req, res) => {
  try {
    const response = await axios.post(`${ML_BASE_URL}/explain`, req.body || {});
    res.json(response.data);
  } catch (error) {
    console.error("ML Service Error:", error.message);
    res.status(500).json({ error: "ML service unavailable" });
  }
});

module.exports = router;
