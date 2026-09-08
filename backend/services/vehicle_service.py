"""
vehicle_service.py — Vehicle-Type Suitability & Recommendation Layer
─────────────────────────────────────────────────────────────────────
Responsibility:
  Evaluate candidate route suitability for user-selected vehicle types
  using transparent, configurable prototype terrain profiles.

IMPORTANT DISCLAIMER:
  The vehicle profiles and maximum slope values configured below are
  prototype decision rules and demo-oriented heuristics for the SIH platform.
  They are NOT scientific vehicle dynamics limits, legal road restrictions,
  or real-world regulatory thresholds.

Integration Architecture:
  Route Generation (Person 1)
      ↓
  Landslide + Waterlogging Risk (Person 2)
      ↓
  Combined Multi-Hazard Risk
      ↓
  Accessibility Score (Person 3 — unchanged mathematical scoring)
      ↓
  Vehicle Suitability Evaluation (vehicle_service.py)
      ↓
  Vehicle-Aware Recommendation Score:
      VehicleAwareScore = 0.8 * AccessibilityScore + 0.2 * VehicleSuitability
"""

from typing import Optional
import logging

log = logging.getLogger(__name__)

# ── Configurable Prototype Vehicle Profiles ──────────────────────────────────
# Note: These represent prototype slope tolerance thresholds in degrees.
VEHICLE_PROFILES = {
    "CAR": {
        "max_slope": 35.0,
        "description": "Standard passenger vehicle with moderate incline capability.",
    },
    "BIKE": {
        "max_slope": 30.0,
        "description": "Two-wheeler with light chassis, sensitive to steep gradients.",
    },
    "SUV": {
        "max_slope": 40.0,
        "description": "High-clearance vehicle designed for rugged and steep terrain.",
    },
    "BUS": {
        "max_slope": 25.0,
        "description": "Heavy commercial passenger carrier requiring gentler slopes.",
    },
    "TRUCK": {
        "max_slope": 20.0,
        "description": "Heavy freight transport with restricted gradient maneuverability.",
    },
    "AMBULANCE": {
        "max_slope": 30.0,
        "description": "Emergency vehicle balancing swift transit with patient ride stability.",
    },
}

VALID_VEHICLE_TYPES = set(VEHICLE_PROFILES.keys())


def get_vehicle_profile(vehicle_type: str) -> dict:
    """Return the prototype profile for a given vehicle type (case-insensitive)."""
    norm = str(vehicle_type).strip().upper()
    return VEHICLE_PROFILES.get(norm, VEHICLE_PROFILES["CAR"])


def calculate_vehicle_suitability(route: dict, vehicle_type: str = "CAR") -> dict:
    """
    Calculate vehicle suitability score and compatibility for a route.

    Reuses existing terrain slope information computed by environmental_service:
      - route.get("average_slope_deg")
      - route.get("slope_deg")
      - route.get("slope")
      - coordinates-based fallback if slope is not directly stored.

    Suitability Model (clamped 0–100):
      - If slope <= max_slope:
          suitability = 100 - 40 * (slope / max_slope)
          compatible = True
      - If slope > max_slope:
          excess = slope - max_slope
          suitability = max(0.0, 60 - 60 * (excess / max_slope))
          compatible = False

    Args:
        route: Route dictionary containing terrain slope or coordinates.
        vehicle_type: User-selected vehicle type (e.g. 'CAR', 'TRUCK').

    Returns:
        Dict with:
          - vehicle_type: str (normalized)
          - vehicle_suitability: float [0..100]
          - vehicle_compatible: bool
          - vehicle_reason: str
    """
    norm_type = str(vehicle_type).strip().upper()
    if norm_type not in VALID_VEHICLE_TYPES:
        norm_type = "CAR"

    profile = VEHICLE_PROFILES[norm_type]
    max_slope = profile["max_slope"]

    # ── Extract terrain slope from existing route metrics ─────────────────────
    slope: Optional[float] = None
    if route.get("average_slope_deg") is not None:
        slope = float(route["average_slope_deg"])
    elif route.get("slope_deg") is not None:
        slope = float(route["slope_deg"])
    elif route.get("slope") is not None:
        slope = float(route["slope"])
    elif route.get("coordinates"):
        try:
            from services.environmental_service import compute_average_slope_deg
            slope = compute_average_slope_deg(route["coordinates"])
        except Exception as exc:
            log.warning("Could not compute slope from coordinates: %s", exc)
            slope = 0.0
    else:
        slope = 0.0

    slope = max(0.0, float(slope))

    # ── Evaluate Suitability and Compatibility ────────────────────────────────
    if slope <= max_slope:
        compatible = True
        # Slope 0° -> 100.0, Slope == max_slope -> 60.0
        ratio = slope / max_slope if max_slope > 0 else 0.0
        suitability = 100.0 - (40.0 * ratio)
        reason = f"Route terrain slope ({slope:.1f}°) is suitable for the selected {norm_type}."
    else:
        compatible = False
        excess = slope - max_slope
        ratio = excess / max_slope if max_slope > 0 else 1.0
        suitability = max(0.0, 60.0 - (60.0 * ratio))
        reason = f"Route terrain slope ({slope:.1f}°) exceeds the configured threshold ({max_slope:.0f}°) for {norm_type}."

    suitability_clamped = round(max(0.0, min(100.0, suitability)), 2)

    return {
        "vehicle_type": norm_type,
        "vehicle_suitability": suitability_clamped,
        "vehicle_compatible": compatible,
        "vehicle_reason": reason,
    }


def apply_vehicle_evaluation(routes: list[dict], vehicle_type: str = "CAR") -> list[dict]:
    """
    Evaluate all candidate routes for the specified vehicle type and compute
    the composite Vehicle-Aware Recommendation Score:

        VehicleAwareScore = 0.8 * AccessibilityScore + 0.2 * VehicleSuitability

    Preserves Person 3's accessibility_score completely intact.
    Selects the recommended route preferentially from compatible routes.

    Args:
        routes: List of route dicts enriched with accessibility_score.
        vehicle_type: Normalized vehicle type string.

    Returns:
        List of routes enriched with vehicle metrics, sorted by vehicle_aware_score
        with recommendation flag set.
    """
    if not routes:
        return []

    norm_type = str(vehicle_type).strip().upper()
    if norm_type not in VALID_VEHICLE_TYPES:
        norm_type = "CAR"

    evaluated_routes = []
    for r in routes:
        route_copy = dict(r)
        veh_result = calculate_vehicle_suitability(route_copy, norm_type)
        route_copy.update(veh_result)

        acc_score = float(route_copy.get("accessibility_score", 0.0))
        veh_suit = float(route_copy.get("vehicle_suitability", 0.0))
        veh_aware = round((0.8 * acc_score) + (0.2 * veh_suit), 2)
        route_copy["vehicle_aware_score"] = veh_aware
        evaluated_routes.append(route_copy)

    # ── Select Recommended Route ──────────────────────────────────────────────
    # Compatible routes prioritized over incompatible routes
    compatible_routes = [r for r in evaluated_routes if r.get("vehicle_compatible", True)]
    recommendation_pool = compatible_routes if compatible_routes else evaluated_routes
    recommended_route = max(recommendation_pool, key=lambda r: r.get("vehicle_aware_score", 0.0))

    # ── Sort and flag recommended ─────────────────────────────────────────────
    # Sort order: compatible routes with higher vehicle_aware_score first,
    # then incompatible routes by vehicle_aware_score
    def _sort_key(r):
        is_comp = 1 if r.get("vehicle_compatible", True) else 0
        return (is_comp, r.get("vehicle_aware_score", 0.0))

    evaluated_routes.sort(key=_sort_key, reverse=True)

    rec_id = recommended_route.get("route_id")
    for r in evaluated_routes:
        r["recommended"] = (r.get("route_id") == rec_id)

    return evaluated_routes
