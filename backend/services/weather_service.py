"""
weather_service.py — Rainfall Data (Open-Meteo)
────────────────────────────────────────────────
Responsibility:
  Fetch historical rainfall data for representative route coordinates using
  the Open-Meteo Historical Weather API (free, no API key required).

Person 2's ML model requires:
  - rainfall_24h_mm  : total precipitation over the previous 24 hours
  - rainfall_7d_mm   : total precipitation over the previous 7 days

Strategy:
  1. Sample up to MAX_WEATHER_SAMPLES representative coordinates from the route.
  2. For each sample, fetch historical precipitation for the last 7 days
     from Open-Meteo (one API call per sample point).
  3. Aggregate across all sampled points:
       rainfall_24h_mm = mean of [last-day precipitation at each sample]
       rainfall_7d_mm  = mean of [7-day sum of precipitation at each sample]
  4. Return {"rainfall_24h_mm": float, "rainfall_7d_mm": float}.

Open-Meteo endpoint:
  https://archive-api.open-meteo.com/v1/archive
  Parameters: latitude, longitude, start_date, end_date,
              daily=precipitation_sum, timezone=auto

Fallback:
  If WEATHER_DEMO=1 env var is set, return realistic demo values for NE India
  monsoon season without hitting the API. Use this for offline development.

CRITICAL:
  Do NOT silently default missing rainfall to 0.
  If the API fails and demo mode is not enabled, raise a clear error.
"""

import os
import json
import math
import logging
import urllib.request
import urllib.parse
import urllib.error
from datetime import date, timedelta

from fastapi import HTTPException

log = logging.getLogger(__name__)

# Maximum weather samples per route (to keep API calls reasonable)
MAX_WEATHER_SAMPLES = 5

# Demo fallback — NE India realistic monsoon season values
_DEMO_RAINFALL_24H = 35.0   # mm
_DEMO_RAINFALL_7D  = 180.0  # mm

# Toggle demo mode with env var
WEATHER_DEMO = os.environ.get("WEATHER_DEMO", "0").strip() == "1"

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
REQUEST_TIMEOUT_SEC = 15


# ── HTTP helper ────────────────────────────────────────────────────────────────

def _http_get_json(url: str) -> dict:
    req = urllib.request.Request(
        url, headers={"User-Agent": "MARG-SIH-WeatherService/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SEC) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Open-Meteo API HTTP error {e.code}: {e.reason}",
        )
    except urllib.error.URLError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Open-Meteo API unreachable: {e.reason}. "
                   "Check internet connection or set WEATHER_DEMO=1 for offline mode.",
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=503,
            detail="Open-Meteo returned invalid JSON.",
        )


# ── Sample coordinates ─────────────────────────────────────────────────────────

def _sample_coords(coords: list[dict], n: int) -> list[dict]:
    """Evenly sample up to n coordinates from the route."""
    total = len(coords)
    if total <= n:
        return coords
    indices = [round(i * (total - 1) / (n - 1)) for i in range(n)]
    return [coords[i] for i in sorted(set(indices))]


# ── Fetch rainfall for one point ───────────────────────────────────────────────

def _fetch_rainfall_for_point(lat: float, lon: float) -> dict:
    """
    Fetch 7 days of daily precipitation from Open-Meteo for one coordinate.

    Returns:
        {
            "daily_precipitation_mm": [float, ...],  # list of 7 values
        }

    Raises HTTPException on API failure.
    """
    today     = date.today()
    end_date  = today - timedelta(days=1)        # yesterday
    start_date = end_date - timedelta(days=6)    # 7 days back

    params = urllib.parse.urlencode({
        "latitude":   round(lat, 4),
        "longitude":  round(lon, 4),
        "start_date": start_date.isoformat(),
        "end_date":   end_date.isoformat(),
        "daily":      "precipitation_sum",
        "timezone":   "auto",
    })
    url = f"{OPEN_METEO_ARCHIVE_URL}?{params}"
    log.debug("Weather API: %s", url)

    data = _http_get_json(url)

    daily = data.get("daily", {})
    precip_list = daily.get("precipitation_sum", [])

    if not precip_list:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Open-Meteo returned no precipitation data for "
                f"lat={lat}, lon={lon}. The archive may not cover this location."
            ),
        )

    # Validate every value: None means the API has no data for that day.
    # Missing rainfall data MUST NOT be silently converted to 0.0 —
    # that would misrepresent unknown conditions as dry/safe to Person 2's ML model.
    # Numeric 0 is a valid observation (genuinely no rain) and is accepted.
    cleaned: list[float] = []
    for i, v in enumerate(precip_list):
        if v is None:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Open-Meteo returned null precipitation for day index {i} "
                    f"at lat={lat}, lon={lon}. "
                    f"Missing rainfall is NOT converted to 0 — unknown conditions "
                    f"must not be treated as dry/safe for ML input."
                ),
            )
        cleaned.append(float(v))

    return {"daily_precipitation_mm": cleaned}



# ── Public API ─────────────────────────────────────────────────────────────────

def get_route_rainfall(coordinates: list[dict]) -> dict:
    """
    Compute rainfall features for a route.

    Args:
        coordinates: List of {"lat": float, "lon": float} dicts
                     from Person 1's route output.

    Returns:
        {
            "rainfall_24h_mm": float,  # mean of last-day precipitation across samples
            "rainfall_7d_mm":  float,  # mean of 7-day total precipitation across samples
        }

    Raises:
        HTTPException(503) if the weather API fails and demo mode is off.
        HTTPException(500) if coordinates are empty.
    """
    if not coordinates:
        raise HTTPException(
            status_code=500,
            detail="Cannot fetch rainfall: route has no coordinates.",
        )

    # ── Demo mode: return realistic hardcoded values without hitting API ───────
    if WEATHER_DEMO:
        log.info("WEATHER_DEMO mode: returning synthetic rainfall values.")
        return {
            "rainfall_24h_mm": _DEMO_RAINFALL_24H,
            "rainfall_7d_mm":  _DEMO_RAINFALL_7D,
        }

    # ── Live API mode ─────────────────────────────────────────────────────────
    sampled = _sample_coords(coordinates, MAX_WEATHER_SAMPLES)
    last_day_values:  list[float] = []
    seven_day_values: list[float] = []

    for coord in sampled:
        lat = coord["lat"]
        lon = coord["lon"]
        try:
            result = _fetch_rainfall_for_point(lat, lon)
            daily = result["daily_precipitation_mm"]
            if daily:
                last_day_values.append(daily[-1])           # previous 24h
                seven_day_values.append(sum(daily))         # 7-day total
        except HTTPException:
            # Log but don't stop — try remaining sample points
            log.warning("Weather API failed for lat=%.4f lon=%.4f", lat, lon)
            continue

    # If ALL sample points failed, raise a clear error
    if not last_day_values:
        raise HTTPException(
            status_code=503,
            detail=(
                "Weather API failed for all sampled route coordinates. "
                "Check internet connectivity or set WEATHER_DEMO=1 "
                "for offline/demo mode (env var)."
            ),
        )

    rainfall_24h = round(sum(last_day_values) / len(last_day_values), 2)
    rainfall_7d  = round(sum(seven_day_values) / len(seven_day_values), 2)

    log.info(
        "Rainfall computed: 24h=%.1f mm, 7d=%.1f mm (from %d sample points)",
        rainfall_24h, rainfall_7d, len(last_day_values),
    )
    return {
        "rainfall_24h_mm": rainfall_24h,
        "rainfall_7d_mm":  rainfall_7d,
    }
