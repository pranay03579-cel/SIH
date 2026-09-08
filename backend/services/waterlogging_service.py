"""
waterlogging_service.py — Environmental Waterlogging Risk Model
─────────────────────────────────────────────────────────────
Responsibility:
  Calculate a transparent, hybrid environmental Waterlogging Risk score (0–100)
  for a route corridor based on recent precipitation, terrain slope,
  flat segment exposure, and local drainage depression metrics.

Mathematical Model:
───────────────────
Waterlogging is primarily caused by intense recent rainfall over flat or
poorly-draining terrain, aggravated by pre-existing soil saturation.

Weighted Factors (each normalised to [0.0, 100.0]):
  1. Rainfall Pressure (45%):
     Recent 24-hour precipitation intensity. Normalised against IMD heavy rainfall
     threshold (60 mm/day = 100%).
     Formula: min(100.0, (rainfall_24h_mm / 60.0) * 100.0)

  2. Flat Terrain Exposure (30%):
     Percentage of route segments with slope < 3.0° where water cannot drain
     readily by gravity.
     Formula: flat_segments_pct (already in [0.0, 100.0])

  3. Drainage Depression Susceptibility (15%):
     Local elevation concave curvature / depression indicator derived from relative
     elevations along the route profile.
     Formula: drainage_depression_score (in [0.0, 100.0])

  4. Rainfall Saturation (10%):
     7-day cumulative antecedent precipitation representing soil saturation and
     drainage catchment saturation. Normalised against 150 mm/week = 100%.
     Formula: min(100.0, (rainfall_7d_mm / 150.0) * 100.0)

Combined Formula:
─────────────────
  waterlogging_risk = (
      0.45 * rainfall_pressure
    + 0.30 * flat_terrain
    + 0.15 * drainage_susceptibility
    + 0.10 * rainfall_saturation
  )

Classification Thresholds:
──────────────────────────
  - LOW:    waterlogging_risk < 30.0
  - MEDIUM: 30.0 <= waterlogging_risk < 60.0
  - HIGH:   waterlogging_risk >= 60.0
"""

import math
import logging

log = logging.getLogger(__name__)


def calculate_waterlogging_risk(
    rainfall_24h_mm: float,
    rainfall_7d_mm: float,
    flat_segments_pct: float,
    drainage_depression_score: float,
    average_slope_deg: float = None,
) -> dict:
    """
    Compute environmental waterlogging risk and component factors for a route.

    Args:
        rainfall_24h_mm: Cumulative rainfall in past 24 hours (mm).
        rainfall_7d_mm: Cumulative rainfall in past 7 days (mm).
        flat_segments_pct: Percentage of route segments with slope < 3°.
        drainage_depression_score: Local relative elevation depression score (0-100).
        average_slope_deg: Optional average route slope in degrees.


    Returns:
        dict with:
          - "waterlogging_risk": float (0.0 to 100.0)
          - "waterlogging_level": "LOW" | "MEDIUM" | "HIGH"
          - "waterlogging_factors": {
                "rainfall_pressure": float (0.0 to 100.0),
                "flat_terrain": float (0.0 to 100.0),
                "drainage_susceptibility": float (0.0 to 100.0),
                "rainfall_saturation": float (0.0 to 100.0)
            }
    """
    # ── 1. Factor Normalisation (each clamped strictly to 0.0 – 100.0) ────────

    # 24h rainfall pressure (60 mm = 100% saturation rate)
    r24 = max(0.0, float(rainfall_24h_mm)) if not math.isnan(rainfall_24h_mm) else 0.0
    f_rainfall_pressure = min(100.0, (r24 / 60.0) * 100.0)

    # Flat terrain exposure (slope < 3 degrees)
    f_flat_terrain = min(100.0, max(0.0, float(flat_segments_pct)))

    # Local drainage depression susceptibility
    f_drainage = min(100.0, max(0.0, float(drainage_depression_score)))

    # 7-day cumulative antecedent rainfall saturation (150 mm = 100%)
    r7d = max(0.0, float(rainfall_7d_mm)) if not math.isnan(rainfall_7d_mm) else 0.0
    f_rainfall_saturation = min(100.0, (r7d / 150.0) * 100.0)

    # ── 2. Weighted Calculation ───────────────────────────────────────────────
    # Weights: 45% rain 24h + 30% flat + 15% drainage depression + 10% rain 7d
    raw_risk = (
        0.45 * f_rainfall_pressure
        + 0.30 * f_flat_terrain
        + 0.15 * f_drainage
        + 0.10 * f_rainfall_saturation
    )

    clamped_risk = max(0.0, min(100.0, raw_risk))
    rounded_risk = round(clamped_risk, 2)

    # ── 3. Level Classification ───────────────────────────────────────────────
    if rounded_risk >= 60.0:
        level = "HIGH"
    elif rounded_risk >= 30.0:
        level = "MEDIUM"
    else:
        level = "LOW"

    return {
        "waterlogging_risk": rounded_risk,
        "waterlogging_level": level,
        "waterlogging_factors": {
            "rainfall_pressure": round(f_rainfall_pressure, 2),
            "flat_terrain": round(f_flat_terrain, 2),
            "drainage_susceptibility": round(f_drainage, 2),
            "rainfall_saturation": round(f_rainfall_saturation, 2),
        },
    }
