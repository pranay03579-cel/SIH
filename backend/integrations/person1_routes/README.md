# MARG Route Service — Person 1 (Route Generation)

Production-ready hackathon route module for **Smart India Hackathon 2026**.  
Generates driving routes between any two places using fully open-source APIs — **no API key required**.

---

## APIs Used

| Purpose      | Service        | URL                                | API Key |
|--------------|----------------|-------------------------------------|---------|
| Geocoding    | Nominatim      | `nominatim.openstreetmap.org`       | None    |
| Routing      | OSRM           | `router.project-osrm.org`           | None    |

- **Nominatim** — OpenStreetMap's official geocoding service.  
- **OSRM** — Open Source Routing Machine; supports `alternatives=true` for multiple routes.

---

## Installation

```bash
# No external packages needed. Python 3.10+ only.
python --version   # must be >= 3.10
```

That's it. `route_service.py` uses **only Python standard library**.

---

## Running

### As a module (Person 4 integration)

```python
from route_service import get_routes

routes = get_routes("Guwahati, Assam", "Silchar, Assam")
print(routes)
```

### From the command line

```bash
python route_service.py "Guwahati, Assam" "Silchar, Assam"
python route_service.py "Shillong, Meghalaya" "Imphal, Manipur"
python route_service.py "New Delhi" "Jaipur, Rajasthan"
```

---

## Running Tests

```bash
# Live API (requires internet)
python test_route_service.py

# Offline / mock mode (no internet needed — CI / development)
set ROUTE_MOCK=1 && python test_route_service.py       # Windows
ROUTE_MOCK=1 python test_route_service.py              # Linux / Mac
```

---

## Output Contract

Every element of the returned list conforms to this exact shape:

```json
[
  {
    "route_id":           "R1",
    "route_name":         "Route 1",
    "distance_km":        350.42,
    "estimated_time_min": 480.5,
    "coordinates": [
      [26.1445, 91.7362],
      [25.8012, 92.4589],
      [25.5788, 93.0156]
    ]
  }
]
```

| Field                 | Type         | Notes                                          |
|-----------------------|--------------|------------------------------------------------|
| `route_id`            | `str`        | `R1`, `R2`, `R3` … unique per call             |
| `route_name`          | `str`        | `"Route 1"`, `"Route 2"` …                    |
| `distance_km`         | `float`      | Total distance in kilometres (rounded to 2 dp) |
| `estimated_time_min`  | `float`      | Travel time in minutes (rounded to 1 dp)       |
| `coordinates`         | `list[list]` | `[[lat, lon], …]` — full route geometry        |

---

## Error Handling

| Exception           | Meaning                                          |
|---------------------|--------------------------------------------------|
| `GeocodingError`    | Place name not found (check spelling)            |
| `RoutingError`      | No road route between the two points             |
| `RouteServiceError` | Network / HTTP failure (check internet)          |

All three inherit from `RouteServiceError` so you can catch them with one handler:

```python
from route_service import get_routes, RouteServiceError

try:
    routes = get_routes(origin, destination)
except RouteServiceError as e:
    print(f"Route fetch failed: {e}")
```

---

## Mock / Fallback Mode (Development Only)

Set the environment variable `ROUTE_MOCK=1` to return synthetic placeholder data  
without hitting any external API. **Never use mock data in production.**

```bash
# Windows
set ROUTE_MOCK=1

# Linux / Mac
export ROUTE_MOCK=1
```

Mock routes are clearly labelled `[MOCK]` in `route_name` so they cannot be  
confused with real data.

---

## API Limitations (Tell Your Team)

1. **OSRM public demo server**  
   - Rate limit: ~1 request per second. Add delay between bulk calls.  
   - No SLA — may be slow or unavailable under heavy load.  
   - For production after the hackathon, self-host OSRM or use a paid provider.

2. **Alternatives not guaranteed**  
   - OSRM returns 1–3 routes. Remote or sparsely-mapped areas may return only 1.  
   - The contract is satisfied as long as ≥ 1 route is returned.

3. **Nominatim rate limit**  
   - Max 1 request per second per the OSM usage policy.  
   - The service already adds a 1-second delay between origin/destination lookups.

4. **Road network coverage**  
   - OSRM uses OSM road data. Remote mountain routes (e.g., some parts of  
     Arunachal Pradesh) may have sparse coverage.  
   - If routing fails, the service raises `RoutingError` — handle gracefully.

5. **Python version**  
   - Requires Python 3.10+ (uses `tuple[float, float]` type hint syntax).  
   - On Python 3.9, change `tuple[float, float]` to `Tuple[float, float]`  
     and add `from typing import Tuple`.

---

## Integration Note for Person 4

```python
# The ONLY function to call:
from route_service import get_routes, RouteServiceError

routes = get_routes(origin_string, destination_string)
# routes is always a list[dict] matching the contract above.
```

`route_id` values (`R1`, `R2` …) are the **primary integration key** for your  
team's scoring and display systems. They are unique within each call and  
stable — do not regenerate or renumber them downstream.
