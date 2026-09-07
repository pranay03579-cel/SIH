# models/

Reserved for **runtime model artifacts**.

## Purpose

This folder may be used during integration to hold copies of production
model files that need to be referenced or loaded at runtime by the backend.

Examples of what may be placed here later:

- A copy of Person 2's trained model file (`.pkl`, `.joblib`) if it needs
  to be in a standardised runtime location separate from the source folder.
- Any compiled or exported model assets.

## Current status

**Empty.** Do NOT place anything here until Person 4 gives explicit
instructions during the integration phase.

## Source of truth

Person 2's original model files live in:

```
integrations/person2_landslide_model/
```

Anything placed here is a runtime copy only — the original must stay
in `integrations/person2_landslide_model/`.
