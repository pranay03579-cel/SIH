"""
models.py
---------
Data models and validation logic for the MARG Route Scoring Engine.

This module defines the input/output structures and performs all input validation
before any scoring computation takes place.
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_URGENCY_LEVELS = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}

# Urgency weights: {urgency: {"distance": w1, "time": w2, "risk": w3}}
# Each set of weights must sum to exactly 1.0
URGENCY_WEIGHTS = {
    "LOW": {
        "distance": 0.30,
        "time":     0.25,
        "risk":     0.45,
    },
    "MEDIUM": {
        "distance": 0.25,
        "time":     0.30,
        "risk":     0.45,
    },
    "HIGH": {
        "distance": 0.20,
        "time":     0.40,
        "risk":     0.40,
    },
    "CRITICAL": {
        "distance": 0.15,
        "time":     0.50,
        "risk":     0.35,
    },
}


# ---------------------------------------------------------------------------
# Custom Exceptions
# ---------------------------------------------------------------------------

class ValidationError(ValueError):
    """Raised when input data fails validation checks."""
    pass


# ---------------------------------------------------------------------------
# Input / Output Data Classes
# ---------------------------------------------------------------------------

@dataclass
class RouteInput:
    """
    Represents a single route provided as input to the scoring engine.

    Fields
    ------
    route_id          : Unique identifier for the route (non-empty string).
    distance_km       : Total route distance in kilometres. Must be >= 0.
    estimated_time_min: Estimated travel time in minutes. Must be >= 0.
    landslide_risk    : Landslide risk score in the range [0, 100].
    route_name        : Optional human-readable name (not used in scoring).
    risk_level        : Optional categorical risk label (not used in scoring).
    """

    route_id: str
    distance_km: float
    estimated_time_min: float
    landslide_risk: float
    route_name: Optional[str] = None
    risk_level: Optional[str] = None


@dataclass
class RouteScore:
    """
    Final accessibility score for a single route.

    Fields
    ------
    route_id           : Same as the input route_id (preserved, never modified).
    accessibility_score: Final score in the range [0.0, 100.0], rounded to 2 dp.
    """

    route_id: str
    accessibility_score: float


@dataclass
class DetailedRouteScore:
    """
    Full breakdown of how the accessibility score was calculated.

    Useful for explaining the score to SIH judges or for debugging.

    Fields
    ------
    route_id           : Same as the input route_id.
    distance_score     : Normalised distance component score (0-100).
    time_score         : Normalised time component score (0-100).
    risk_score         : Risk component score = 100 - landslide_risk.
    distance_weight    : Weight applied to distance_score.
    time_weight        : Weight applied to time_score.
    risk_weight        : Weight applied to risk_score.
    accessibility_score: Final weighted score (0-100), rounded to 2 dp.
    """

    route_id: str
    distance_score: float
    time_score: float
    risk_score: float
    distance_weight: float
    time_weight: float
    risk_weight: float
    accessibility_score: float


# ---------------------------------------------------------------------------
# Validation Helpers
# ---------------------------------------------------------------------------

def _is_invalid_float(value) -> bool:
    """Return True if value is NaN, Infinity, or not a real finite number."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return True
    return not math.isfinite(f)


def validate_urgency(urgency: str) -> str:
    """
    Validate and normalise the urgency string.

    Parameters
    ----------
    urgency : str
        Urgency level provided by the caller (case-insensitive).

    Returns
    -------
    str
        Upper-cased urgency level, guaranteed to be one of the valid values.

    Raises
    ------
    ValidationError
        If urgency is not one of: LOW, MEDIUM, HIGH, CRITICAL.
    """
    if not isinstance(urgency, str):
        raise ValidationError(
            f"urgency must be a string, got {type(urgency).__name__!r}."
        )

    normalised = urgency.strip().upper()

    if normalised not in VALID_URGENCY_LEVELS:
        raise ValidationError(
            f"Invalid urgency {urgency!r}. "
            f"Must be one of: {', '.join(sorted(VALID_URGENCY_LEVELS))}."
        )

    return normalised


def validate_route(route: dict, index: int) -> RouteInput:
    """
    Validate a single raw route dictionary and convert it to a RouteInput.

    Parameters
    ----------
    route : dict
        Raw route data dictionary from the caller.
    index : int
        Zero-based position of this route in the input list (used in errors).

    Returns
    -------
    RouteInput
        Validated and typed route object.

    Raises
    ------
    ValidationError
        On any validation failure (missing field, wrong type, out-of-range, etc.).
    """
    # ---- route_id ----------------------------------------------------------
    route_id = route.get("route_id")
    if route_id is None:
        raise ValidationError(
            f"Route at index {index} is missing 'route_id'."
        )
    if not isinstance(route_id, str) or not route_id.strip():
        raise ValidationError(
            f"Route at index {index}: 'route_id' must be a non-empty string, "
            f"got {route_id!r}."
        )

    # ---- distance_km -------------------------------------------------------
    if "distance_km" not in route or route["distance_km"] is None:
        raise ValidationError(
            f"Route '{route_id}': 'distance_km' is missing or null."
        )
    if _is_invalid_float(route["distance_km"]):
        raise ValidationError(
            f"Route '{route_id}': 'distance_km' must be a finite number, "
            f"got {route['distance_km']!r}."
        )
    distance_km = float(route["distance_km"])
    if distance_km < 0:
        raise ValidationError(
            f"Route '{route_id}': 'distance_km' must be >= 0, got {distance_km}."
        )

    # ---- estimated_time_min ------------------------------------------------
    if "estimated_time_min" not in route or route["estimated_time_min"] is None:
        raise ValidationError(
            f"Route '{route_id}': 'estimated_time_min' is missing or null."
        )
    if _is_invalid_float(route["estimated_time_min"]):
        raise ValidationError(
            f"Route '{route_id}': 'estimated_time_min' must be a finite number, "
            f"got {route['estimated_time_min']!r}."
        )
    estimated_time_min = float(route["estimated_time_min"])
    if estimated_time_min < 0:
        raise ValidationError(
            f"Route '{route_id}': 'estimated_time_min' must be >= 0, "
            f"got {estimated_time_min}."
        )

    # ---- landslide_risk ----------------------------------------------------
    if "landslide_risk" not in route or route["landslide_risk"] is None:
        raise ValidationError(
            f"Route '{route_id}': 'landslide_risk' is missing or null."
        )
    if _is_invalid_float(route["landslide_risk"]):
        raise ValidationError(
            f"Route '{route_id}': 'landslide_risk' must be a finite number, "
            f"got {route['landslide_risk']!r}."
        )
    landslide_risk = float(route["landslide_risk"])
    if not (0 <= landslide_risk <= 100):
        raise ValidationError(
            f"Route '{route_id}': 'landslide_risk' must be in [0, 100], "
            f"got {landslide_risk}."
        )

    return RouteInput(
        route_id=route_id.strip(),
        distance_km=distance_km,
        estimated_time_min=estimated_time_min,
        landslide_risk=landslide_risk,
        route_name=route.get("route_name"),
        risk_level=route.get("risk_level"),
    )


def validate_routes(routes: list) -> List[RouteInput]:
    """
    Validate an entire list of raw route dictionaries.

    Also checks:
    - The list is non-empty.
    - route_id values are unique across the list.

    Parameters
    ----------
    routes : list
        List of raw route dictionaries.

    Returns
    -------
    List[RouteInput]
        List of validated RouteInput objects.

    Raises
    ------
    ValidationError
        If the list is empty, any route is invalid, or route IDs are not unique.
    """
    if not isinstance(routes, list) or len(routes) == 0:
        raise ValidationError(
            "The route list must be a non-empty list of route dictionaries."
        )

    validated: List[RouteInput] = []
    seen_ids: set = set()

    for idx, raw_route in enumerate(routes):
        if not isinstance(raw_route, dict):
            raise ValidationError(
                f"Each route must be a dictionary. "
                f"Got {type(raw_route).__name__!r} at index {idx}."
            )

        route_input = validate_route(raw_route, idx)

        if route_input.route_id in seen_ids:
            raise ValidationError(
                f"Duplicate route_id found: '{route_input.route_id}'. "
                f"All route IDs must be unique."
            )

        seen_ids.add(route_input.route_id)
        validated.append(route_input)

    return validated
