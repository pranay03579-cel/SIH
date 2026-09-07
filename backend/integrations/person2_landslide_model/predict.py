import os
import joblib
import pandas as pd
from pathlib import Path

# ── Model path — absolute so it works regardless of working directory ──────────
_THIS_DIR = Path(__file__).parent
MODEL_PATH = str(_THIS_DIR / "landslide_model.pkl")

FEATURES = [
    "rainfall_24h_mm",
    "rainfall_7d_mm",
    "slope_deg"
]


# --------------------------------------------------
# LOAD MODEL
# --------------------------------------------------

model = joblib.load(MODEL_PATH)


# --------------------------------------------------
# RISK LEVEL
# --------------------------------------------------

def get_risk_level(risk):

    if risk < 30:
        return "LOW"

    elif risk < 60:
        return "MEDIUM"

    else:
        return "HIGH"


# --------------------------------------------------
# PREDICT LANDSLIDE RISK
# --------------------------------------------------

def predict_landslide_risk(
    rainfall_24h_mm,
    rainfall_7d_mm,
    slope_deg
):

    input_data = pd.DataFrame(
        [[
            rainfall_24h_mm,
            rainfall_7d_mm,
            slope_deg
        ]],
        columns=FEATURES
    )

    # Probability of class 1 = landslide
    probability = model.predict_proba(input_data)[0][1]

    # Convert probability to 0-100
    risk = round(probability * 100)

    risk_level = get_risk_level(risk)

    return {
        "landslide_risk": risk,
        "risk_level": risk_level
    }


# --------------------------------------------------
# TEST
# --------------------------------------------------

if __name__ == "__main__":

    result = predict_landslide_risk(
        rainfall_24h_mm=80,
        rainfall_7d_mm=300,
        slope_deg=35
    )

    print("\nMARG LANDSLIDE RISK")
    print("===================")

    print(
        f"Landslide Risk: "
        f"{result['landslide_risk']}%"
    )

    print(
        f"Risk Level: "
        f"{result['risk_level']}"
    )
