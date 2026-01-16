import axios from "axios";

const ML_API_URL = "http://localhost:8000/predict";

export const getMLScore = async (features) => {
  const response = await axios.post(ML_API_URL, features);
  return response.data.score;
};
