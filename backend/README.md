# MARG Backend

**AI-Based Smart Logistics and Accessibility Intelligence Platform**
*North Eastern Region of India*

---

## The Problem

In the North Eastern Region of India, difficult terrain, extreme weather,
landslides, floods, and infrastructure gaps can make the shortest route
**unsafe or inaccessible**.

Traditional navigation systems recommend the **shortest** route.

MARG recommends the **most accessible** route.

> **Core Principle: Shortest Route ≠ Most Accessible Route**

---

## The Solution

MARG analyses multiple possible routes between any origin and destination
and recommends the best one based on:

- Distance
- Estimated travel time
- Landslide risk (ML-predicted)
- Delivery urgency
- Mathematical accessibility score

---

## Team Architecture — 5-Person Pipeline

```
USER
  ↓
Origin + Destination + Urgency
  ↓
Person 1 — Route Generation (open-source map API)
  ↓
Multiple Possible Routes
  ↓
Person 2 — ML Landslide Risk Prediction
  ↓
Risk Score per Route
  ↓
Person 3 — Mathematical Accessibility Scoring
  ↓
Accessibility Score per Route
  ↓
Person 4 — FastAPI Backend (THIS REPO)
Merge → Rank → Recommend
  ↓
Person 5 — React Frontend (interactive map)
```

The common key across all pipeline stages is **`route_id`**.

---

## Project Structure

```
backend/
├── main.py                         # FastAPI app — thin orchestration layer
├── requirements.txt                # Python dependencies (fastapi, uvicorn)
├── README.md                       # This file
│
├── data/
│   └── demo_routes.json            # DEMO/FALLBACK data only (see below)
│
└── services/
    ├── __init__.py
    ├── route_service.py            # Person 1 integration point
    ├── risk_service.py             # Person 2 integration point
    ├── scoring_service.py          # Person 3 integration point
    └── recommendation_service.py  # Person 4 merge + rank logic
```

---

## Installation & Running

### 1. (Optional) Create a virtual environment

```bash
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac / Linux
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the server

```bash
uvicorn main:app --reload
```

Server will be live at: **http://127.0.0.1:8000**

### 4. Interactive API docs (Swagger UI)

```
http://127.0.0.1:8000/docs
```

Test every endpoint in the browser — no Postman needed.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/routes` | All demo routes (optionally filtered by corridor) |
| GET | `/routes/{route_id}` | Single route by ID |
| POST | `/recommend-route` | **Main endpoint** — AI route recommendation |

---

### GET `/`

```json
{ "status": "MARG Backend Running" }
```

---

### GET `/routes`

Returns demo routes from `data/demo_routes.json`.

| Query Parameters | Behaviour |
|-----------------|-----------|
| None | Returns all routes across all corridors |
| `?origin=X&destination=Y` | Returns routes for that corridor only |
| `?origin=X` only | **400 error** — both params required |
| `?destination=Y` only | **400 error** — both params required |

Filtering is case-insensitive.

---

### GET `/routes/{route_id}`

Returns the full route object for the given `route_id`.

- Case-insensitive: `R1`, `r1`, `r1` all work.
- Returns **HTTP 404** if the ID does not exist.

---

### POST `/recommend-route`

**The main endpoint.** Orchestrates the full pipeline.

**Request body:**
```json
{
  "origin": "Guwahati",
  "destination": "Silchar",
  "urgency": "HIGH"
}
```

> **Note:** Guwahati → Silchar is DEMO DATA. The backend supports any
> origin and destination that has routes in the data store.

**Urgency values:** `LOW` | `MEDIUM` | `HIGH` | `CRITICAL` (case-insensitive)

**Validation rules:**
- `origin` and `destination` must not be empty or whitespace-only
- `origin` and `destination` must be different
- `urgency` must be one of the four allowed values

**Response:**
```json
{
  "origin": "Guwahati",
  "destination": "Silchar",
  "urgency": "HIGH",
  "recommended_route_id": "R2",
  "recommended_route": {
    "route_id": "R2",
    "route_name": "Guwahati - Shillong - Jowai - Silchar",
    "distance_km": 205,
    "estimated_time_min": 285,
    "coordinates": [...],
    "landslide_risk": 25,
    "risk_level": "LOW",
    "accessibility_score": 87,
    "recommended": true
  },
  "routes": [ ... ]
}
```

- Exactly **one** route will have `"recommended": true`
- All other routes will have `"recommended": false`
- Recommendation is recalculated fresh on **every request** — never read from stored state

---

## Demo Data

`data/demo_routes.json` is **fallback/demo data only**.

It provides 9 sample routes across 3 corridors so the backend is
immediately testable without any teammates' components being connected:

| Route ID | Corridor | Distance | Risk | Score |
|----------|---------|---------|------|-------|
| R1 | Guwahati → Silchar | 180 km | HIGH | 42 |
| R2 | Guwahati → Silchar | 205 km | LOW | **87** ✅ |
| R3 | Guwahati → Silchar | 220 km | MEDIUM | 71 |
| R4 | Guwahati → Silchar | 265 km | HIGH | 38 |
| R5 | Guwahati → Silchar | 330 km | LOW | 79 |
| R6 | Guwahati → Imphal | 495 km | HIGH | 45 |
| R7 | Guwahati → Imphal | 460 km | MEDIUM | 66 |
| R8 | Guwahati → Aizawl | 510 km | HIGH | 51 |
| R9 | Guwahati → Aizawl | 480 km | MEDIUM | 74 |

This file will be **replaced** by Person 1's live route-generation API
and Person 2's live ML predictions in production.

---

## Team Integration Guide

### Person 1 — Route Generation

**File:** `services/route_service.py`

**Function to replace:** `get_routes(origin, destination)`

Replace the body of `get_routes()` with a call to your open-source map API
(OSRM, GraphHopper, OpenRouteService, etc.).

Your function must return a list of route dicts with these fields:
```python
{
    "route_id":           str,    # unique per route, e.g. "R1"
    "route_name":         str,
    "distance_km":        float,  # must be > 0
    "estimated_time_min": float,  # must be > 0
    "coordinates": [              # REQUIRED FORMAT — list of dicts
        {"lat": 26.1445, "lon": 91.7362},
        {"lat": 25.5788, "lon": 91.8933},
        ...
    ]
}
```

> **Coordinate format contract:** Every coordinate MUST be a dict with `"lat"` and `"lon"` keys.
> Do **NOT** use `[[lat, lon], ...]` array format — it will be rejected by the validation layer.
> `lat` must be in `[-90, 90]`, `lon` must be in `[-180, 180]`. Booleans, strings, NaN, and
> infinity are all rejected.

---

### Person 2 — Landslide Risk Prediction

**File:** `services/risk_service.py`

**Function to replace:** `predict_route_risk(route)`

Replace the body of `predict_route_risk()` with a call to your ML model.

Your function receives the full route dict and must return:
```python
{
    "route_id":       str,    # must match input route's route_id
    "landslide_risk": int,    # 0–100, higher = more dangerous
    "risk_level":     str     # "LOW" | "MEDIUM" | "HIGH"
}
```

> **Critical:** Missing risk data does NOT mean a route is safe.
> If your model cannot predict risk for a route, raise an error —
> do not return `landslide_risk = 0`.

---

### Person 3 — Mathematical Accessibility Scoring

**File:** `services/scoring_service.py`

**Function to replace:** `calculate_accessibility_score(...)`

Replace the body between the `REPLACE` markers with your formula.

Inputs provided:
```python
urgency:            str    # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
landslide_risk:     float  # 0–100
estimated_time_min: float  # minutes
distance_km:        float  # kilometres
existing_score:     float  # demo fallback (remove when your formula is ready)
```

Your function must return a `float` in `[0.0, 100.0]`.
Higher = better / more accessible route.

---

### Person 4 — Backend Orchestration

**File:** `main.py` + `services/recommendation_service.py`

`main.py` is the FastAPI layer. It validates requests and calls the services.

`recommendation_service.py` contains `merge_pipeline_data()` and
`rank_and_recommend()` — these merge all data by `route_id` and select
the best route. These are Person 4's responsibility.

---

### Person 5 — Frontend Integration

**CORS** is enabled for `http://localhost:3000` and `http://localhost:5173`.

**Page load:**
```
GET /routes?origin=Guwahati&destination=Silchar
```
Use the returned `routes` array to draw all routes on the map.
Each route's `coordinates` field is an array of `{"lat": ..., "lon": ...}` objects:
```json
[
  {"lat": 26.1445, "lon": 91.7362},
  {"lat": 25.5788, "lon": 91.8933}
]
```
Use `coordinate.lat` and `coordinate.lon` to draw polylines on the map.

**AI Recommendation button click:**
```
POST /recommend-route
Body: { "origin": "Guwahati", "destination": "Silchar", "urgency": "HIGH" }
```
Highlight the route where `recommended == true`.
Show route details from `recommended_route`.

**Route click (detail view):**
```
GET /routes/R2
```
Or use the already-loaded route data from the `routes` array.

---

## Quick Test (curl)

```bash
# Health check
curl http://127.0.0.1:8000/

# All routes
curl http://127.0.0.1:8000/routes

# Corridor filter
curl "http://127.0.0.1:8000/routes?origin=Guwahati&destination=Silchar"

# Single route
curl http://127.0.0.1:8000/routes/R2

# Recommendation
curl -X POST http://127.0.0.1:8000/recommend-route \
  -H "Content-Type: application/json" \
  -d '{"origin": "Guwahati", "destination": "Silchar", "urgency": "HIGH"}'
```
