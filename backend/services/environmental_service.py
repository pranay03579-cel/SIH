"""
environmental_service.py — Elevation & Slope Computation
─────────────────────────────────────────────────────────
Responsibility:
  Load the Northeast India elevation dataset once at startup and
  compute the average slope (in degrees) across a route's coordinates.

Dataset:
  data/elevation/MARG_synthetic_NE_elevated_terrain_50000_points.csv
  Columns: point_id, latitude, longitude, elevation_m

Algorithm:
  1. Build a KD-Tree from (latitude, longitude) pairs for O(log n) lookup.
  2. For each set of route coordinates, sample up to MAX_ROUTE_SAMPLES points
     evenly spaced along the route geometry.
  3. For each sampled point, find the nearest elevation dataset point.
  4. For consecutive pairs, compute:
       horizontal_dist = haversine_km(pt1, pt2) * 1000  [metres]
       elevation_diff  = abs(elev2 - elev1)             [metres]
       slope_rad       = atan(elevation_diff / horizontal_dist)
       slope_deg       = degrees(slope_rad)
  5. Return the mean of all valid segment slopes.

The KD-Tree is built once when this module is first imported, so
there is no repeated 50,000-point scan per request.
"""

import math
import logging
from pathlib import Path
from functools import lru_cache

import numpy as np
import pandas as pd
from scipy.spatial import KDTree
from fastapi import HTTPException

log = logging.getLogger(__name__)

# ── Dataset path ──────────────────────────────────────────────────────────────
_ELEVATION_CSV = (
    Path(__file__).parent.parent
    / "data" / "elevation"
    / "MARG_synthetic_NE_elevated_terrain_50000_points.csv"
)

# Maximum number of coordinate samples taken per route for slope calculation.
# 15 evenly-spaced points gives a good average without saturating the KD-Tree.
MAX_ROUTE_SAMPLES = 15


# ── Dataset loading — done once at import time ─────────────────────────────────

def _load_elevation_data():
    """Load the elevation CSV and build a KD-Tree. Called once at module import."""
    if not _ELEVATION_CSV.exists():
        raise RuntimeError(
            f"Elevation dataset not found: {_ELEVATION_CSV}. "
            "Place the CSV file in data/elevation/ before starting the backend."
        )
    log.info("Loading elevation dataset from %s …", _ELEVATION_CSV)
    df = pd.read_csv(_ELEVATION_CSV, usecols=["latitude", "longitude", "elevation_m"])
    df = df.dropna(subset=["latitude", "longitude", "elevation_m"])
    df = df.astype({"latitude": float, "longitude": float, "elevation_m": float})

    lats = df["latitude"].to_numpy()
    lons = df["longitude"].to_numpy()
    elevs = df["elevation_m"].to_numpy()

    # KD-Tree over (lat, lon) — good enough for geographic nearest-neighbour
    # when the search area is small (NE India spans ~4° lat × ~12° lon).
    tree = KDTree(np.column_stack([lats, lons]))
    log.info("Elevation KD-Tree built: %d points.", len(elevs))
    return tree, elevs


# Module-level singletons — loaded once
try:
    _ELEV_TREE, _ELEV_VALUES = _load_elevation_data()
    _ELEVATION_AVAILABLE = True
except Exception as _elev_err:
    log.warning("Elevation data unavailable: %s", _elev_err)
    _ELEV_TREE = None
    _ELEV_VALUES = None
    _ELEVATION_AVAILABLE = False


# ── Haversine distance ─────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in kilometres between two (lat, lon) points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Nearest elevation lookup ───────────────────────────────────────────────────

def _elevation_at(lat: float, lon: float) -> float:
    """Return the nearest elevation_m value for a (lat, lon) point."""
    _, idx = _ELEV_TREE.query([lat, lon])
    return float(_ELEV_VALUES[idx])


# ── Sample coordinates evenly along route ─────────────────────────────────────

def _sample_coords(coords: list[dict], n: int) -> list[dict]:
    """
    Return up to n coordinate dicts evenly spaced along the route.
    Always includes the first and last point.
    """
    total = len(coords)
    if total <= n:
        return coords
    indices = [round(i * (total - 1) / (n - 1)) for i in range(n)]
    return [coords[i] for i in sorted(set(indices))]


# ── Public API ─────────────────────────────────────────────────────────────────

def compute_average_slope_deg(coordinates: list[dict]) -> float:
    """
    Compute the average slope (in degrees) along a route.

    Args:
        coordinates: List of {"lat": float, "lon": float} dicts
                     from Person 1's route output.

    Returns:
        float — average slope in degrees across all valid consecutive segments.
        Returns 0.0 if fewer than 2 sampled points produce a valid segment.

    Raises:
        HTTPException(503) if the elevation dataset is unavailable.
        HTTPException(500) if coordinates are empty or malformed.
    """
    if not _ELEVATION_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Elevation dataset is not available. "
                "Place MARG_synthetic_NE_elevated_terrain_50000_points.csv "
                "in data/elevation/ and restart the backend."
            ),
        )
    if not coordinates:
        raise HTTPException(
            status_code=500,
            detail="Cannot compute slope: route has no coordinates.",
        )

    # Sample evenly — up to MAX_ROUTE_SAMPLES points
    sampled = _sample_coords(coordinates, MAX_ROUTE_SAMPLES)
    if len(sampled) < 2:
        log.warning("Only 1 coordinate sampled — returning slope 0.0")
        return 0.0

    slopes: list[float] = []
    for i in range(len(sampled) - 1):
        p1 = sampled[i]
        p2 = sampled[i + 1]
        lat1, lon1 = p1["lat"], p1["lon"]
        lat2, lon2 = p2["lat"], p2["lon"]

        elev1 = _elevation_at(lat1, lon1)
        elev2 = _elevation_at(lat2, lon2)

        horiz_m = _haversine_km(lat1, lon1, lat2, lon2) * 1000.0
        if horiz_m < 1.0:
            # Points are essentially co-located — skip to avoid division noise
            continue

        slope_rad = math.atan(abs(elev2 - elev1) / horiz_m)
        slope_deg = math.degrees(slope_rad)
        slopes.append(slope_deg)

    if not slopes:
        log.warning("No valid slope segments computed — returning 0.0")
        return 0.0

    avg_slope = float(np.mean(slopes))
    log.debug("Average slope: %.2f° from %d segments", avg_slope, len(slopes))
    return round(avg_slope, 4)
