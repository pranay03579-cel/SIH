# MARG — Route Accessibility Scoring Engine
### Person 3 · Standalone Component · Smart India Hackathon

---

## What This Is

This is the **Route Scoring / Accessibility Intelligence Engine** for **MARG**
(*Smart Route Accessibility & Logistics Intelligence Platform*).

> **"Shortest Route ≠ Best Route"**

This standalone module receives a list of candidate routes and calculates an
**Accessibility Score (0–100)** for each one.  
**Higher score = better/more suitable route.**

This component is completely independent. It:
- Does **not** call any external API
- Does **not** use a database
- Does **not** require coordinates
- Does **not** select a final recommended route
- Does **not** depend on any other team member's code

---

## Project Structure

```
person3_scoring_engine/
│
├── scoring_engine.py   ← Main scoring logic (import from here)
├── models.py           ← Data models, constants, and validation
├── demo.py             ← Standalone demo / quick test
├── test_scoring.py     ← Full test suite (25+ test cases)
├── requirements.txt    ← No third-party packages needed
└── README.md           ← This file
```

---

## What Input It Requires

### 1. Route List

A Python `list` of route dictionaries. Each dictionary **must** contain:

| Field                 | Type    | Constraint         |
|-----------------------|---------|--------------------|
| `route_id`            | `str`   | Non-empty, unique  |
| `distance_km`         | `float` | >= 0, finite       |
| `estimated_time_min`  | `float` | >= 0, finite       |
| `landslide_risk`      | `float` | 0 to 100, finite   |

Optional fields (accepted but not used in scoring):
- `route_name` (str)
- `risk_level` (str)

**Example:**
```json
[
    {
        "route_id": "R1",
        "route_name": "Route via Haflong",
        "distance_km": 180,
        "estimated_time_min": 240,
        "landslide_risk": 82,
        "risk_level": "HIGH"
    },
    {
        "route_id": "R2",
        "route_name": "Route via Shillong",
        "distance_km": 205,
        "estimated_time_min": 285,
        "landslide_risk": 25,
        "risk_level": "LOW"
    },
    {
        "route_id": "R3",
        "route_name": "Alternative Route",
        "distance_km": 195,
        "estimated_time_min": 260,
        "landslide_risk": 45,
        "risk_level": "MEDIUM"
    }
]
```

### 2. Urgency

A string: `"LOW"` | `"MEDIUM"` | `"HIGH"` | `"CRITICAL"`  
(Case-insensitive — internally normalised to uppercase.)

---

## Mathematical Formula

### Step 1 — Normalise Distance
```
distance_score = 100 × (max_distance - distance) / (max_distance - min_distance)
```
Shorter distance → higher score.

### Step 2 — Normalise Travel Time
```
time_score = 100 × (max_time - time) / (max_time - min_time)
```
Shorter travel time → higher score.

### Step 3 — Risk Score
```
risk_score = 100 - landslide_risk
```
Lower landslide risk → higher score. **Not normalised** — it is an absolute formula.

### Step 4 — Weighted Sum
```
accessibility_score = (distance_score × distance_weight)
                    + (time_score     × time_weight)
                    + (risk_score     × risk_weight)
```

Final score is:
- Rounded to **2 decimal places**
- Clamped to **[0.0, 100.0]**

---

## Urgency Weights

| Urgency    | distance | time | risk | Total |
|------------|----------|------|------|-------|
| `LOW`      | 0.30     | 0.25 | 0.45 | 1.00  |
| `MEDIUM`   | 0.25     | 0.30 | 0.45 | 1.00  |
| `HIGH`     | 0.20     | 0.40 | 0.40 | 1.00  |
| `CRITICAL` | 0.15     | 0.50 | 0.35 | 1.00  |

As urgency increases, **travel time** becomes more important. All weights always
sum to exactly **1.0**.

---

## Normalization Logic

Both `distance_score` and `time_score` are **batch-normalised** across all routes
provided in a single call. This ensures fair relative comparison.

`risk_score` is **not normalised** — it is an absolute formula (`100 - risk`).

---

## Edge-Case Handling

| Scenario                               | Behaviour                                                        |
|----------------------------------------|------------------------------------------------------------------|
| All routes have the same distance      | `distance_score = 100` for every route (no division by zero)    |
| All routes have the same travel time   | `time_score = 100` for every route (no division by zero)        |
| Only one route                         | `distance_score = 100`, `time_score = 100`, `risk_score` normal |
| `landslide_risk` = 0                   | `risk_score = 100` (perfectly safe)                             |
| `landslide_risk` = 100                 | `risk_score = 0`   (maximum danger)                             |
| NaN or Infinity in any numeric field   | `ValidationError` raised — not silently converted               |
| `None` / missing field                 | `ValidationError` raised — not silently converted to 0          |
| Negative distance or time              | `ValidationError` raised                                        |
| `landslide_risk` outside [0, 100]      | `ValidationError` raised                                        |
| Empty route list                       | `ValidationError` raised                                        |
| Duplicate `route_id`                   | `ValidationError` raised                                        |
| Missing `route_id`                     | `ValidationError` raised                                        |

---

## How to Install Dependencies

**No third-party packages are required.**

This engine uses only Python standard library:
- `math`, `dataclasses`, `typing`, `unittest`, `json`, `sys`

Required Python version: **>= 3.8**

---

## How to Run the Tests

```bash
# Using the built-in runner:
python test_scoring.py

# Using pytest (optional — not required):
python -m pytest test_scoring.py -v
```

Expected output: all tests pass.

---

## How to Run the Demo

```bash
python demo.py
```

This will show:
- Input routes
- Simple accessibility scores
- Detailed / explainable scores
- Formula explanation
- Edge-case outputs (single route, same distance, same time)
- Urgency comparison table

---

## How to Import the Scoring Engine

```python
from scoring_engine import score_routes

routes = [
    {
        "route_id": "R1",
        "distance_km": 180,
        "estimated_time_min": 240,
        "landslide_risk": 82,
    },
    {
        "route_id": "R2",
        "distance_km": 205,
        "estimated_time_min": 285,
        "landslide_risk": 25,
    },
]

results = score_routes(routes, "HIGH")

for r in results:
    print(r.route_id, r.accessibility_score)
```

For a full score breakdown (useful for SIH judge explanations):

```python
from scoring_engine import score_routes_detailed

details = score_routes_detailed(routes, "HIGH")

for d in details:
    print(d)
```

---

## Output Format

### Simple (`score_routes`)

```json
[
    {"route_id": "R1", "accessibility_score": 47.20},
    {"route_id": "R2", "accessibility_score": 30.00}
]
```

### Detailed (`score_routes_detailed`)

```json
[
    {
        "route_id": "R1",
        "distance_score": 100.0,
        "time_score": 100.0,
        "risk_score": 18.0,
        "distance_weight": 0.20,
        "time_weight": 0.40,
        "risk_weight": 0.40,
        "accessibility_score": 47.20
    }
]
```

---

---

## HANDOFF TO BACKEND DEVELOPER

> **Read this section before integrating the scoring engine.**

### Which file contains the main logic?

**`scoring_engine.py`** — all public functions live here.  
**`models.py`** — data models, weights, and validation (imported by scoring_engine.py).

### Which function should be imported?

```python
from scoring_engine import score_routes          # primary function
from scoring_engine import score_routes_detailed # for explainable output
```

### What input format does it expect?

```python
routes  : list  # list of Python dicts (see "What Input It Requires" above)
urgency : str   # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" (case-insensitive)
```

Each route dict **must** have these keys:
- `"route_id"` — non-empty string, unique
- `"distance_km"` — float >= 0
- `"estimated_time_min"` — float >= 0
- `"landslide_risk"` — float in [0, 100]

Optional keys are silently ignored.

### What output does it return?

`score_routes()` returns `List[RouteScore]`.  
Each `RouteScore` has:
- `route_id: str` — **identical to the input route_id, never modified**
- `accessibility_score: float` — range [0.0, 100.0], rounded to 2 dp

`score_routes_detailed()` returns `List[DetailedRouteScore]`.  
Each `DetailedRouteScore` additionally has `distance_score`, `time_score`,
`risk_score`, `distance_weight`, `time_weight`, `risk_weight`.

### What errors can be raised?

Only one exception type: `models.ValidationError` (subclass of `ValueError`).

Triggered by:
- Invalid urgency string
- Empty route list
- Missing `route_id`, `distance_km`, `estimated_time_min`, or `landslide_risk`
- `route_id` is empty or not a string
- Duplicate `route_id` values
- Negative distance or time
- `landslide_risk` outside [0, 100]
- NaN or Infinity in any numeric field
- `None` in any required field

Import the exception if you need to catch it:
```python
from models import ValidationError
```

### Is `route_id` modified?

**No.** The engine always returns the exact same `route_id` string that was
provided as input. It never generates, modifies, or re-orders IDs.

### Does this component select a recommended route?

**No.** This component only calculates and returns scores.  
Route ranking and final recommendation is the responsibility of another
component. Do not look for a `"recommended"` field — it will never be here.

### Minimum example integration snippet:

```python
from models import ValidationError
from scoring_engine import score_routes

try:
    results = score_routes(route_data_from_other_component, urgency)
    # results: List[RouteScore]
    scores = [{"route_id": r.route_id, "accessibility_score": r.accessibility_score}
              for r in results]
except ValidationError as e:
    # Return a 400-level error to the caller
    print("Bad input:", e)
```

---

*Person 3 — Route Scoring / Accessibility Intelligence Engine*  
*MARG · Smart India Hackathon*
