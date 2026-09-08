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

def compute_terrain_waterlogging_metrics(coordinates: list[dict]) -> dict:
    """
    Compute terrain metrics relevant for landslide and waterlogging risk:
      1. average_slope_deg: Mean slope in degrees across sampled segments.
      2. flat_segments_pct: Percentage of segments where slope < 3.0 degrees.
      3. drainage_depression_score: Metric (0-100) indicating the prevalence and depth
         of local depressions / valley basins relative to adjacent terrain along the route.

    Args:
        coordinates: List of {"lat": float, "lon": float} dicts.

    Returns:
        Dict with keys:
          - "average_slope_deg": float
          - "flat_segments_pct": float (0.0 to 100.0)
          - "drainage_depression_score": float (0.0 to 100.0)

    Raises:
        HTTPException(503) if elevation dataset is unavailable.
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
            detail="Cannot compute terrain metrics: route has no coordinates.",
        )

    sampled = _sample_coords(coordinates, MAX_ROUTE_SAMPLES)
    if len(sampled) < 2:
        log.warning("Only 1 coordinate sampled — returning default 0.0 terrain metrics")
        return {
            "average_slope_deg": 0.0,
            "flat_segments_pct": 0.0,
            "drainage_depression_score": 0.0,
        }

    elevations: list[float] = []
    slopes: list[float] = []

    for i in range(len(sampled)):
        pt = sampled[i]
        elevations.append(_elevation_at(pt["lat"], pt["lon"]))

    for i in range(len(sampled) - 1):
        p1 = sampled[i]
        p2 = sampled[i + 1]
        lat1, lon1 = p1["lat"], p1["lon"]
        lat2, lon2 = p2["lat"], p2["lon"]

        elev1 = elevations[i]
        elev2 = elevations[i + 1]

        horiz_m = _haversine_km(lat1, lon1, lat2, lon2) * 1000.0
        if horiz_m < 1.0:
            # Points are essentially co-located — skip to avoid division noise
            continue

        slope_rad = math.atan(abs(elev2 - elev1) / horiz_m)
        slope_deg = math.degrees(slope_rad)
        slopes.append(slope_deg)

    if not slopes:
        log.warning("No valid slope segments computed — returning 0.0")
        return {
            "average_slope_deg": 0.0,
            "flat_segments_pct": 0.0,
            "drainage_depression_score": 0.0,
        }

    avg_slope = float(np.mean(slopes))
    flat_count = sum(1 for s in slopes if s < 3.0)
    flat_pct = (flat_count / len(slopes)) * 100.0

    # Drainage / local depression calculation
    # Evaluates relative dips in elevation between consecutive points
    # (avoiding absolute elevation bias)
    n_elev = len(elevations)
    if n_elev < 3:
        # Route is very short — baseline drainage based on flatness
        dep_score = 20.0 if avg_slope < 3.0 else 0.0
    else:
        interior_count = n_elev - 2
        dip_scores: list[float] = []
        strict_min_count = 0

        for i in range(1, n_elev - 1):
            e_prev = elevations[i - 1]
            e_curr = elevations[i]
            e_next = elevations[i + 1]

            e_baseline = (e_prev + e_next) / 2.0

            # Strict local depression (trough lower than both neighbors)
            if e_curr < min(e_prev, e_next):
                strict_min_count += 1
                dip_depth = min(e_prev - e_curr, e_next - e_curr)
                # 20m local depression represents a substantial natural water collection basin
                dip_score = min(100.0, (dip_depth / 20.0) * 100.0)
            elif e_curr < e_baseline:
                # Concave profile / valley shoulder
                concavity = e_baseline - e_curr
                dip_score = min(50.0, (concavity / 20.0) * 50.0)
            else:
                dip_score = 0.0

            dip_scores.append(dip_score)

        mean_dip = float(np.mean(dip_scores)) if dip_scores else 0.0
        strict_min_pct = (strict_min_count / interior_count) * 100.0
        raw_dep_score = 0.6 * mean_dip + 0.4 * strict_min_pct
        dep_score = float(max(0.0, min(100.0, raw_dep_score)))

    return {
        "average_slope_deg": round(avg_slope, 4),
        "flat_segments_pct": round(flat_pct, 2),
        "drainage_depression_score": round(dep_score, 2),
    }


def compute_average_slope_deg(coordinates: list[dict]) -> float:
    """
    Compute the average slope (in degrees) along a route.
    Maintained for 100% backward compatibility with existing ML pipelines.

    Args:
        coordinates: List of {"lat": float, "lon": float} dicts.

    Returns:
        float — average slope in degrees across all valid consecutive segments.
    """
    metrics = compute_terrain_waterlogging_metrics(coordinates)
    return metrics["average_slope_deg"]

