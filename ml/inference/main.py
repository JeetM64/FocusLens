"""
FocusLens ML Inference Service
Receives feature windows, returns cognitive state predictions.
Phase 1: rule-based fallback
Phase 4: trained model loaded from disk
"""
import os
import json
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import joblib
import uvicorn

app = FastAPI(title="FocusLens ML Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Feature names — must match what TelemetryService._computeFeatures() returns
FEATURE_NAMES = [
    "switchDensity",
    "typingVariance",
    "meanWpm",
    "idleRatio",
    "focusContinuity",
    "meanCorrectionRate",
    "interactionEntropy",
    "uniqueApps"
]

LABELS = ["focused", "distracted", "fatigued", "overloaded", "neutral"]

# Load model if available
model = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), "../models/saved/rf_model.pkl")

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print(f"[ML] Model loaded from {MODEL_PATH}")
    else:
        print("[ML] No trained model found — using rule-based fallback")

load_model()


class FeatureWindow(BaseModel):
    sessionId: str
    switchDensity: float
    typingVariance: float
    meanWpm: float
    idleRatio: float
    focusContinuity: float
    meanCorrectionRate: float
    interactionEntropy: float
    uniqueApps: int
    windowMs: Optional[int] = 300000
    eventCount: Optional[int] = 0


class PredictionResponse(BaseModel):
    sessionId: str
    label: str
    confidence: float
    probabilities: dict
    modelType: str
    features: dict


def rule_based_predict(features: dict) -> tuple[str, float, dict]:
    """
    Heuristic fallback when no trained model is available.
    Returns (label, confidence, probabilities).
    """
    sd = features["switchDensity"]
    tv = features["typingVariance"]
    ir = features["idleRatio"]
    fc = features["focusContinuity"]
    ie = features["interactionEntropy"]
    cr = features["meanCorrectionRate"]

    scores = {
        "focused": 0.0,
        "distracted": 0.0,
        "fatigued": 0.0,
        "overloaded": 0.0,
        "neutral": 0.5
    }

    # Focused: low switches, low idle, high continuity
    if sd < 3 and ir < 0.1 and fc > 0.6:
        scores["focused"] += 2.0
    
    # Distracted: high switches, high entropy, low continuity
    if sd > 8:
        scores["distracted"] += 1.5
    if ie > 2.5:
        scores["distracted"] += 1.0
    if fc < 0.15:
        scores["distracted"] += 1.0

    # Fatigued: high idle, low WPM
    if ir > 0.4:
        scores["fatigued"] += 2.0

    # Overloaded: high variance, high correction rate
    if tv > 40 and cr > 0.1:
        scores["overloaded"] += 2.0

    # Softmax normalization
    total = sum(scores.values())
    probs = {k: round(v / total, 3) for k, v in scores.items()}
    label = max(probs, key=probs.get)
    confidence = probs[label]

    return label, confidence, probs


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}


@app.post("/predict", response_model=PredictionResponse)
def predict(window: FeatureWindow):
    features = {k: getattr(window, k) for k in FEATURE_NAMES}

    if model is not None:
        try:
            X = np.array([[features[f] for f in FEATURE_NAMES]])
            label = model.predict(X)[0]
            proba = model.predict_proba(X)[0]
            probabilities = {LABELS[i]: round(float(proba[i]), 3) for i in range(len(LABELS))}
            confidence = float(max(proba))
            model_type = "random_forest"
        except Exception as e:
            print(f"[ML] Model inference error: {e} — falling back to rules")
            label, confidence, probabilities = rule_based_predict(features)
            model_type = "rule_based_fallback"
    else:
        label, confidence, probabilities = rule_based_predict(features)
        model_type = "rule_based"

    return PredictionResponse(
        sessionId=window.sessionId,
        label=label,
        confidence=confidence,
        probabilities=probabilities,
        modelType=model_type,
        features=features
    )


@app.post("/reload-model")
def reload_model():
    load_model()
    return {"loaded": model is not None, "path": MODEL_PATH}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)