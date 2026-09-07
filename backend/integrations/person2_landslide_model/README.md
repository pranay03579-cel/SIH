# Person 2 — Landslide Risk ML Model

Place Person 2's **complete landslide risk prediction implementation** here.

## What belongs here

This folder receives Person 2's trained ML model and all supporting files
needed to run inference. Do NOT retrain the model or modify it.

Typical contents:

| File type | Examples |
|-----------|---------|
| Trained model | `model.pkl`, `landslide_model.joblib`, `model.h5` |
| Scaler / preprocessor | `scaler.pkl`, `preprocessor.joblib` |
| Inference / prediction code | `predict.py`, `inference.py`, `model.py` |
| Preprocessing utilities | `preprocess.py`, `features.py` |
| Training code (reference only) | `train.py` |
| Documentation | Person 2's own `README.md` |

## What to place here

```
integrations/person2_landslide_model/
├── <model files, .pkl, .joblib, etc.>
├── <inference / prediction Python code>
├── <preprocessing / scaler files>
└── README.md  ← this file
```

## Backend integration point

Once Person 2's files are placed here, the backend owner (Person 4) will
update:

```
services/risk_service.py  →  predict_route_risk(route)
```

The function must return:

```python
{
    "route_id":       str,    # MUST match the input route's route_id exactly
    "landslide_risk": float,  # 0–100, higher = more dangerous; NOT a boolean
    "risk_level":     str     # "LOW" | "MEDIUM" | "HIGH"  (any case — normalised automatically)
}
```

**Critical rules:**
- `route_id` in the output MUST match the `route_id` of the input route.
- `landslide_risk` must be a number (not `True`/`False`).
- Missing risk data does NOT mean a route is safe — raise an error instead.

## Do NOT modify

Do not modify any existing backend files (`main.py`, `services/`, etc.)
when placing files here. Notify Person 4 when ready to integrate.
