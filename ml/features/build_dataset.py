"""
FocusLens Feature Engineering
Pulls labeled sessions from the backend, computes feature windows,
and outputs a CSV ready for model training.

Usage:
  python features/build_dataset.py --output data/labeled/dataset.csv
"""
import argparse
import csv
import json
import math
import requests
import sys
from datetime import datetime

BACKEND_URL = "http://localhost:3001"

FEATURE_COLS = [
    "switchDensity", "typingVariance", "meanWpm", "idleRatio",
    "focusContinuity", "meanCorrectionRate", "interactionEntropy",
    "uniqueApps", "eventCount", "windowMs"
]
LABEL_COL = "label"
META_COLS = ["sessionId", "labeledAt", "confidence"]


def fetch_sessions(user_id: str) -> list:
    r = requests.get(f"{BACKEND_URL}/api/sessions/user/{user_id}", timeout=10)
    r.raise_for_status()
    return r.json().get("sessions", [])


def export_session(session_id: str) -> list:
    """Returns list of {features..., label, ...} rows for one session."""
    r = requests.get(f"{BACKEND_URL}/api/analytics/{session_id}/export", timeout=30)
    r.raise_for_status()
    return r.json().get("rows", [])


def build_dataset(user_id: str, output_path: str):
    print(f"[Dataset] Fetching sessions for user: {user_id}")
    sessions = fetch_sessions(user_id)
    print(f"[Dataset] Found {len(sessions)} sessions")

    all_rows = []
    for s in sessions:
        try:
            rows = export_session(s["id"])
            all_rows.extend(rows)
            print(f"  Session {s['id'][:8]}... → {len(rows)} labeled windows")
        except Exception as e:
            print(f"  Session {s['id'][:8]}... → ERROR: {e}")

    if not all_rows:
        print("[Dataset] No labeled rows found. Run the desktop app and label your states first.")
        sys.exit(1)

    # Write CSV
    fieldnames = META_COLS + FEATURE_COLS + [LABEL_COL]
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"\n[Dataset] ✓ Saved {len(all_rows)} rows to {output_path}")

    # Quick label distribution report
    dist = {}
    for row in all_rows:
        dist[row["label"]] = dist.get(row["label"], 0) + 1
    print("\nLabel distribution:")
    for label, count in sorted(dist.items()):
        pct = count / len(all_rows) * 100
        print(f"  {label:12} {count:4} ({pct:.1f}%)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--user", required=True, help="User ID to export")
    parser.add_argument("--output", default="data/labeled/dataset.csv")
    parser.add_argument("--backend", default=BACKEND_URL)
    args = parser.parse_args()

    BACKEND_URL = args.backend
    build_dataset(args.user, args.output)