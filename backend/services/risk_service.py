"""
risk_service.py — Person 2 Integration Point
─────────────────────────────────────────────
Responsibility: Predict landslide risk for each route using an ML model.

CURRENT STATE: DEMO FALLBACK
    In demo mode, risk data is pre-embedded in demo_routes.json alongside
    route data. The service reads it directly from the route object.

    This means in demo mode:
      - If a route in the JSON has landslide_risk + risk_level → used as-is.
      - If a route is missing these fields → route is EXCLUDED from
        recommendation (not silently treated as safe).

HOW PERSON 2 INTEGRATES:
    Replace the body of `predict_route_risk()` with a call to Person 2's
    ML model.

    Example:

        from person2_module import ml_predict_risk

        def predict_route_risk(route: dict) -> dict:
            return ml_predict_risk(route)

    The returned dict must follow this schema:
        {
            "route_id":       str,   # MUST match the input route's route_id
            "landslide_risk": float, # 0–100, higher = more dangerous; not bool
            "risk_level":     str    # "LOW" | "MEDIUM" | "HIGH" (any case → normalised)
        }

CRITICAL DESIGN RULES:
    1. Missing risk data does NOT mean a route is safe.
       A route without confirmed risk prediction must raise an error.
    2. landslide_risk must be numeric (int or float), NOT bool.
    3. risk_level is normalised to uppercase before validation.
    4. The returned route_id must match the input route's route_id.
"""

import math
from fastapi import HTTPException

VALID_RISK_LEVELS = {"LOW", "MEDIUM", "HIGH"}


def _validate_risk(risk_data: dict, expected_route_id: str) -> None:
    """
    Validate risk data returned by Person 2's model and the waterlogging engine.

    Checks:
    - route_id must be present and match expected_route_id
    - landslide_risk must be present, numeric (not bool), finite, and in [0, 100]
    - risk_level must be present and normalised to LOW/MEDIUM/HIGH
    - waterlogging_risk must be present, numeric (not bool), finite, and in [0, 100]
    - waterlogging_level must be LOW/MEDIUM/HIGH
    - combined_hazard_risk must be numeric in [0, 100]
    """
    # ── route_id match ────────────────────────────────────────────────────
    if "route_id" not in risk_data:
        raise HTTPException(
            status_code=500,
            detail=f"Person 2 integration error: risk output is missing 'route_id'. "
                   f"Expected route_id='{expected_route_id}'.",
        )
    if risk_data["route_id"] != expected_route_id:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Person 2 integration error: route_id mismatch. "
                f"Input route was '{expected_route_id}' but Person 2 returned "
                f"route_id='{risk_data['route_id']}'. "
                f"route_id is the primary integration key — output must match input."
            ),
        )

    # ── landslide_risk ────────────────────────────────────────────────────
    if "landslide_risk" not in risk_data:
        raise HTTPException(
            status_code=500,
            detail=f"Risk data for route '{expected_route_id}' is missing 'landslide_risk'.",
        )
    lr = risk_data["landslide_risk"]
    if isinstance(lr, bool) or not isinstance(lr, (int, float)):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': landslide_risk must be numeric. "
                   f"Got: {lr!r}",
        )
    if math.isnan(lr) or math.isinf(lr) or not (0 <= lr <= 100):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': landslide_risk must be a finite number in [0, 100]. "
                   f"Got: {lr}",
        )

    # ── risk_level (landslide) ───────────────────────────────────────────
    if "risk_level" not in risk_data:
        raise HTTPException(
            status_code=500,
            detail=f"Risk data for route '{expected_route_id}' is missing 'risk_level'.",
        )
    rl_raw = risk_data["risk_level"]
    if not isinstance(rl_raw, str):
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': risk_level must be a string. "
                   f"Got type: {type(rl_raw).__name__!r}",
        )
    rl_normalised = rl_raw.strip().upper()
    if rl_normalised not in VALID_RISK_LEVELS:
        raise HTTPException(
            status_code=500,
            detail=f"Route '{expected_route_id}': risk_level must be LOW, MEDIUM, or HIGH. "
                   f"Got: '{rl_raw}'",
        )
    risk_data["risk_level"] = rl_normalised
    risk_data["landslide_risk_level"] = rl_normalised

    # ── waterlogging_risk ────────────────────────────────────────────────
    if "waterlogging_risk" in risk_data:
        wr = risk_data["waterlogging_risk"]
        if isinstance(wr, bool) or not isinstance(wr, (int, float)):
            raise HTTPException(
                status_code=500,
                detail=f"Route '{expected_route_id}': waterlogging_risk must be numeric. Got: {wr!r}",
            )
        if math.isnan(wr) or math.isinf(wr) or not (0 <= wr <= 100):
            raise HTTPException(
                status_code=500,
                detail=f"Route '{expected_route_id}': waterlogging_risk must be in [0, 100]. Got: {wr}",
            )

    # ── waterlogging_level ───────────────────────────────────────────────
    if "waterlogging_level" in risk_data:
        wl_raw = str(risk_data["waterlogging_level"]).strip().upper()
        if wl_raw not in VALID_RISK_LEVELS:
            raise HTTPException(
                status_code=500,
                detail=f"Route '{expected_route_id}': waterlogging_level must be LOW, MEDIUM, or HIGH. Got: '{wl_raw}'",
            )
        risk_data["waterlogging_level"] = wl_raw

    # ── combined_hazard_risk ─────────────────────────────────────────────
    if "combined_hazard_risk" in risk_data:
        cr = risk_data["combined_hazard_risk"]
        if isinstance(cr, bool) or not isinstance(cr, (int, float)):
            raise HTTPException(
                status_code=500,
                detail=f"Route '{expected_route_id}': combined_hazard_risk must be numeric. Got: {cr!r}",
            )
        if math.isnan(cr) or math.isinf(cr) or not (0 <= cr <= 100):
            raise HTTPException(
                status_code=500,
                detail=f"Route '{expected_route_id}': combined_hazard_risk must be in [0, 100]. Got: {cr}",
            )


# ── CENTRAL RISK PREDICTION INTEGRATION ───────────────────────────────────────

def predict_route_risk(route: dict) -> dict:
    """
    Predict landslide risk, waterlogging risk, and combined hazard risk for a single route.

    Environmental Pipeline:
        1. Terrain analysis (environmental_service): slope, flat segments %, depression indicator.
        2. Weather analysis (weather_service): rainfall_24h_mm, rainfall_7d_mm from Open-Meteo.
        3. ML Landslide inference (person2_landslide_model): RandomForest model.
        4. Waterlogging risk inference (waterlogging_service): 45/30/15/10 weighted formula.
        5. Probabilistic combined hazard risk:
             L = landslide_risk / 100
             W = waterlogging_risk / 100
             combined_hazard_risk = (1 - (1 - L) * (1 - W)) * 100

    Args:
        route: A route dict from get_routes(), must contain 'coordinates'.

    Returns:
        Dict with:
          - route_id: str
          - landslide_risk: float (0–100)
          - risk_level: str ("LOW" | "MEDIUM" | "HIGH")
          - landslide_risk_level: str ("LOW" | "MEDIUM" | "HIGH")
          - waterlogging_risk: float (0–100)
          - waterlogging_level: str ("LOW" | "MEDIUM" | "HIGH")
          - waterlogging_factors: dict (rainfall_pressure, flat_terrain, drainage_susceptibility, rainfall_saturation)
          - combined_hazard_risk: float (0–100)

    Raises:
        HTTPException if environmental data or risk calculations fail.
    """
    route_id    = route.get("route_id", "UNKNOWN")
    coordinates = route.get("coordinates", [])

    import sys
    from pathlib import Path as _Path

    # ── Step 1: Compute terrain metrics from elevation dataset ───────────────
    from services.environmental_service import compute_terrain_waterlogging_metrics
    terrain_metrics = compute_terrain_waterlogging_metrics(coordinates)
    slope_deg                  = terrain_metrics["average_slope_deg"]
    flat_segments_pct          = terrain_metrics["flat_segments_pct"]
    drainage_depression_score  = terrain_metrics["drainage_depression_score"]

    # ── Step 2: Fetch rainfall from Open-Meteo ───────────────────────────────
    from services.weather_service import get_route_rainfall
    rainfall = get_route_rainfall(coordinates)
    rainfall_24h_mm = rainfall["rainfall_24h_mm"]
    rainfall_7d_mm  = rainfall["rainfall_7d_mm"]

    # ── Step 3: ML Landslide Model Inference ──────────────────────────────────
    import importlib.util as _ilu
    _P2_PREDICT = _Path(__file__).parent.parent / "integrations" / "person2_landslide_model" / "predict.py"
    _spec = _ilu.spec_from_file_location("p2_predict", str(_P2_PREDICT))
    predict_mod = _ilu.module_from_spec(_spec)
    _spec.loader.exec_module(predict_mod)

    landslide_res = predict_mod.predict_landslide_risk(
        rainfall_24h_mm = rainfall_24h_mm,
        rainfall_7d_mm  = rainfall_7d_mm,
        slope_deg       = slope_deg,
    )
    lr = float(landslide_res["landslide_risk"])
    rl = str(landslide_res["risk_level"]).strip().upper()

    # ── Step 4: Waterlogging Risk Calculation ────────────────────────────────
    from services.waterlogging_service import calculate_waterlogging_risk
    wl_res = calculate_waterlogging_risk(
        rainfall_24h_mm           = rainfall_24h_mm,
        rainfall_7d_mm            = rainfall_7d_mm,
        average_slope_deg         = slope_deg,
        flat_segments_pct         = flat_segments_pct,
        drainage_depression_score = drainage_depression_score,
    )
    wr = float(wl_res["waterlogging_risk"])
    wl = str(wl_res["waterlogging_level"]).strip().upper()

    # ── Step 5: Probabilistic Multi-Hazard Risk Combination ──────────────────
    # L = landslide risk [0..1], W = waterlogging risk [0..1]
    # Combined = 1 - (1 - L) * (1 - W)
    l_prob = lr / 100.0
    w_prob = wr / 100.0
    combined_prob = 1.0 - ((1.0 - l_prob) * (1.0 - w_prob))
    combined_risk = round(max(0.0, min(100.0, combined_prob * 100.0)), 2)

    risk_data = {
        "route_id":             route_id,
        "landslide_risk":       lr,
        "risk_level":           rl,
        "landslide_risk_level": rl,
        "waterlogging_risk":    wr,
        "waterlogging_level":   wl,
        "waterlogging_factors": wl_res["waterlogging_factors"],
        "combined_hazard_risk": combined_risk,
        "average_slope_deg":    slope_deg,
        "slope_deg":            slope_deg,
    }

    # Validate and normalise output
    _validate_risk(risk_data, expected_route_id=route_id)
    return risk_data


def predict_risks_for_routes(routes: list[dict]) -> dict[str, dict]:
    """
    Run predict_route_risk() for every route in the list.

    Returns a dict keyed by route_id for easy lookup:
        { "R1": { "route_id": "R1", "landslide_risk": 82, "waterlogging_risk": 45, ... }, ... }

    Routes for which risk cannot be determined raise an error immediately.
    """
    return {r["route_id"]: predict_route_risk(r) for r in routes}

