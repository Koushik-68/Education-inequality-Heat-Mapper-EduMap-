// routes/predict.js
const express = require("express");
const axios = require("axios");

const router = express.Router();

router.post("/predict-district", async (req, res) => {
  try {
    // 👇 VALUES COME FROM FRONTEND
    const {
      Literacy_Rate,
      Good_Room_Percent,
      Repair_Room_Percent,
      Teacher_Vacancy_Rate,
      PTR,
    } = req.body;

    const response = await axios.post("http://localhost:8000/predict", {
      Literacy_Rate,
      Good_Room_Percent,
      Repair_Room_Percent,
      Teacher_Vacancy_Rate,
      PTR,
    });

    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "ML prediction failed" });
  }
});

module.exports = router;
