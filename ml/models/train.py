"""
FocusLens Model Trainer
Trains Random Forest, XGBoost, and evaluates both.
Saves the best model to models/saved/rf_model.pkl

Usage:
  python models/train.py --data data/labeled/dataset.csv
"""
import argparse
import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score, train_test_split, StratifiedKFold
from sklearn.metrics import (classification_report, confusion_matrix,
                             accuracy_score, f1_score)
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb

FEATURE_COLS = [
    "switchDensity", "typingVariance", "meanWpm", "idleRatio",
    "focusContinuity", "meanCorrectionRate", "interactionEntropy",
    "uniqueApps"
]
LABEL_COL = "label"
SAVE_DIR = os.path.join(os.path.dirname(__file__), "saved")


def load_data(path: str):
    df = pd.read_csv(path)
    print(f"[Train] Loaded {len(df)} rows")
    print(f"[Train] Label distribution:\n{df[LABEL_COL].value_counts()}\n")

    X = df[FEATURE_COLS].fillna(0).values
    y = df[LABEL_COL].values
    return X, y, df


def train_random_forest(X_train, y_train):
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=5,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)
    return model


def train_xgboost(X_train, y_train, label_encoder):
    le = label_encoder
    y_enc = le.transform(y_train)

    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="mlogloss",
        random_state=42
    )
    model.fit(X_train, y_enc)
    return model


def evaluate(model, X_test, y_test, name: str, label_encoder=None):
    if label_encoder:
        y_pred_enc = model.predict(X_test)
        y_pred = label_encoder.inverse_transform(y_pred_enc)
    else:
        y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")

    print(f"\n{'='*50}")
    print(f"  {name}")
    print(f"{'='*50}")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  F1 (weighted): {f1:.4f}")
    print(f"\n{classification_report(y_test, y_pred)}")

    return {"model": name, "accuracy": acc, "f1_weighted": f1}


def feature_importance(model, name: str):
    importances = model.feature_importances_
    pairs = sorted(zip(FEATURE_COLS, importances), key=lambda x: -x[1])
    print(f"\n[{name}] Feature importances:")
    for feat, imp in pairs:
        bar = "█" * int(imp * 30)
        print(f"  {feat:25} {imp:.4f}  {bar}")


def save_results(results: list, path: str):
    with open(path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n[Train] Results saved to {path}")


def main(data_path: str):
    os.makedirs(SAVE_DIR, exist_ok=True)

    X, y, df = load_data(data_path)

    le = LabelEncoder()
    le.fit(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"[Train] Train: {len(X_train)} | Test: {len(X_test)}")

    # Random Forest
    print("\n[Train] Training Random Forest...")
    rf = train_random_forest(X_train, y_train)
    rf_results = evaluate(rf, X_test, y_test, "Random Forest")
    feature_importance(rf, "Random Forest")

    # XGBoost
    print("\n[Train] Training XGBoost...")
    xgb_model = train_xgboost(X_train, y_train, le)
    xgb_results = evaluate(xgb_model, X_test, y_test, "XGBoost", label_encoder=le)
    feature_importance(xgb_model, "XGBoost")

    # Cross-validation on RF (5-fold)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf, X, y, cv=cv, scoring="f1_weighted", n_jobs=-1)
    print(f"\n[Train] RF 5-fold CV F1: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    rf_results["cv_f1_mean"] = float(cv_scores.mean())
    rf_results["cv_f1_std"] = float(cv_scores.std())

    # Save RF as default model (best performing on this type of tabular data)
    rf_path = os.path.join(SAVE_DIR, "rf_model.pkl")
    joblib.dump(rf, rf_path)
    print(f"\n[Train] ✓ RF model saved to {rf_path}")

    # Save XGBoost
    xgb_path = os.path.join(SAVE_DIR, "xgb_model.pkl")
    joblib.dump(xgb_model, xgb_path)

    # Save label encoder
    joblib.dump(le, os.path.join(SAVE_DIR, "label_encoder.pkl"))

    # Save experiment results
    save_results(
        [rf_results, xgb_results],
        os.path.join(SAVE_DIR, "experiment_results.json")
    )

    print("\n[Train] ✓ Training complete")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/labeled/dataset.csv")
    args = parser.parse_args()
    main(args.data)