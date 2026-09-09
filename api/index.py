import sys
import os
from pathlib import Path

# Ensure backend directory and all required module paths are in sys.path
_ROOT_DIR = Path(__file__).resolve().parent.parent
_BACKEND_DIR = _ROOT_DIR / "backend"
_P1_DIR = _BACKEND_DIR / "integrations" / "person1_routes"
_P2_DIR = _BACKEND_DIR / "integrations" / "person2_landslide_model"
_P3_DIR = _BACKEND_DIR / "integrations" / "person3_scoring_engine"

for p in [str(_BACKEND_DIR), str(_P1_DIR), str(_P2_DIR), str(_P3_DIR), str(_ROOT_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Import the configured FastAPI app from backend.main
from main import app
