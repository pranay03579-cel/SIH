# integrations/

This folder contains external components built by other team members.

Each subfolder is a separate integration point. Do NOT modify any files
inside these folders unless explicitly instructed.

| Folder | Owner | Purpose |
|--------|-------|---------|
| `person1_routes/` | Person 1 | Route-generation code using open-source map/routing APIs |
| `person2_landslide_model/` | Person 2 | Trained ML model and inference code for landslide risk prediction |

## How these plug into the backend

- **Person 1** → `services/route_service.py` → replace the body of `get_routes()`
- **Person 2** → `services/risk_service.py` → replace the body of `predict_route_risk()`

Do NOT move or rename files placed here without checking with the backend owner (Person 4) first.
