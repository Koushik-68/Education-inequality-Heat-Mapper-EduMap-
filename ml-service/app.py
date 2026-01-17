from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
import uvicorn
import os
import json
from typing import Dict
import numpy as np

try:
    import shap  # type: ignore
    HAS_SHAP = True
except Exception:
    HAS_SHAP = False

app = FastAPI(title="EduMap ML Service")

# =========================
# PATHS
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "education_inequality_model.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "feature_scaler.pkl")
DISTRICT_DATA_PATH = os.path.join(BASE_DIR, "district_features.json")

# =========================
# LOAD MODEL & SCALER
# =========================
model = joblib.load(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)

print("✅ Model and scaler loaded successfully")

# =========================
# SHAP EXPLAINER (OPTIONAL)
# =========================
explainer = None
FEATURE_ORDER = [
    "population_lakhs",
    "literacy_rate",
    "pupil_teacher_ratio",
    "teacher_difference",
]

if HAS_SHAP:
    try:
        # Build background on original feature space (unscaled)
        if os.path.exists(DISTRICT_DATA_PATH):
            with open(DISTRICT_DATA_PATH, "r") as f:
                district_data: Dict[str, Dict[str, float]] = json.load(f)
            df_bg = pd.DataFrame(district_data).T
            df_bg = df_bg[FEATURE_ORDER]
            X_bg = df_bg.values
        else:
            # Minimal background: zeros
            df_bg = pd.DataFrame([[0, 0, 0, 0]], columns=FEATURE_ORDER)
            X_bg = df_bg.values

        # Predict function that handles scaling and feature names internally
        def predict_fn(X_np):
            df_in = pd.DataFrame(X_np, columns=FEATURE_ORDER)
            X_scaled = scaler.transform(df_in)
            return model.predict(X_scaled)

        explainer = shap.Explainer(predict_fn, X_bg)
        print("✅ SHAP Explainer initialized (model-agnostic with background)")
    except Exception as e:
        explainer = None
        print(f"⚠️ SHAP initialization failed: {e}")

# =========================
# EXPECTED FEATURES
# =========================
FEATURES = [
    "population_lakhs",
    "literacy_rate",
    "pupil_teacher_ratio",
    "teacher_difference",
]

# =========================
# SCHEMA
# =========================
class PredictRequest(BaseModel):
    population_lakhs: float
    literacy_rate: float
    pupil_teacher_ratio: float
    teacher_difference: float

# --------------------------------------------------
# 1️⃣b EXPLANATION FOR SINGLE PREDICTION
# --------------------------------------------------
@app.post("/explain")
def explain(data: PredictRequest):
    if not HAS_SHAP or explainer is None:
        return {"error": "SHAP not available. Install 'shap' and restart ML service."}
    df = pd.DataFrame([[
        data.population_lakhs,
        data.literacy_rate,
        data.pupil_teacher_ratio,
        data.teacher_difference,
    ]], columns=FEATURE_ORDER)

    # Call explainer on original (unscaled) features; predict_fn handles scaling
    sv = explainer(df.values)

    # SHAP values for the single sample (robust to output types)
    try:
        values = sv.values[0].tolist()
        base = float(sv.base_values[0]) if hasattr(sv, "base_values") else None
    except Exception:
        values = sv[0].tolist() if hasattr(sv, "__getitem__") else [0.0] * len(FEATURE_ORDER)
        base = None

    # Compute prediction consistently
    pred = float(model.predict(scaler.transform(df))[0])

    # Sum of contributions (sanity check vs base and pred)
    try:
        sum_contrib = float(np.sum(values))
    except Exception:
        sum_contrib = float(sum(values)) if isinstance(values, list) else 0.0

    contributions = {
        FEATURE_ORDER[i]: float(values[i]) for i in range(len(FEATURE_ORDER))
    }

    # Red = increases inequality (positive), Blue = reduces (negative)
    signs = {k: ("increase" if v >= 0 else "reduce") for k, v in contributions.items()}

    return {
        "prediction": round(pred, 3),
        "base_value": round(base, 3) if base is not None else None,
        "sum_contributions": round(sum_contrib, 3),
        "base_plus_sum": round((base + sum_contrib), 3) if base is not None else None,
        "contributions": contributions,
        "effect": signs,
        "input_used": data.dict(),
    }

# =========================
# ROUTES
# =========================

@app.get("/")
def health():
    return {"status": "ML service running"}

# -------------------------
# SINGLE PREDICTION (SLIDER)
# -------------------------
@app.post("/predict")
def predict(data: PredictRequest):
    df = pd.DataFrame([[getattr(data, f) for f in FEATURES]], columns=FEATURES)
    df_scaled = scaler.transform(df)
    prediction = model.predict(df_scaled)[0]

    return {
        "EII": round(float(prediction), 4),
        "input_used": data.dict()
    }

# -------------------------
# DISTRICT-WISE BASELINE
# -------------------------
@app.post("/predict-district-wise")
def predict_district_wise():
    if not os.path.exists(DISTRICT_DATA_PATH):
        return {"error": "district_features.json not found"}

    with open(DISTRICT_DATA_PATH, "r") as f:
        district_data: Dict[str, Dict[str, float]] = json.load(f)

    results = {}

    for district, features in district_data.items():
        # ✅ Ensure all features exist
        for ftr in FEATURES:
            if ftr not in features:
                raise ValueError(f"{district} missing feature: {ftr}")

        df = pd.DataFrame([[features[f] for f in FEATURES]], columns=FEATURES)
        df_scaled = scaler.transform(df)
        prediction = model.predict(df_scaled)[0]

        results[district] = {
            "EII": round(float(prediction), 4),
            "features": features
        }

    return {
        "state": "Karnataka",
        "district_predictions": results
    }

# =========================
# RUN
# =========================
if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
