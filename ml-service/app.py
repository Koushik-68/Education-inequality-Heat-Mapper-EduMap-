from fastapi import FastAPI
import joblib
import pandas as pd
import uvicorn
import os

app = FastAPI()

# Absolute path to model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "education_model.pkl")

# Load model using JOBLIB (IMPORTANT)
model = joblib.load(MODEL_PATH)
print("Model loaded successfully.")

@app.post("/predict")
def predict(data: dict):
    """
    Expected input JSON:
    {
      "Literacy_Rate": 75.5,
      "Good_Room_Percent": 68.2,
      "Repair_Room_Percent": 15.0,
      "Teacher_Vacancy_Rate": 12.3,
      "PTR": 28.0
    }
    """

    # Convert input to DataFrame with EXACT feature names
    df = pd.DataFrame([{
        "Literacy_Rate": data["Literacy_Rate"],
        "Good_Room_Percent": data["Good_Room_Percent"],
        "Repair_Room_Percent": data["Repair_Room_Percent"],
        "Teacher_Vacancy_Rate": data["Teacher_Vacancy_Rate"],
        "PTR": data["PTR"]
    }])

    prediction = model.predict(df)[0]

    return {
        "EII": round(float(prediction), 4)
    }

if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
