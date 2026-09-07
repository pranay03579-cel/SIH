import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score


# --------------------------------------------------
# 1. LOAD DATASET
# --------------------------------------------------

DATASET_PATH = "landslide_dataset.csv"

df = pd.read_csv(DATASET_PATH)

print("\nDataset loaded successfully.")
print(f"Total samples: {len(df)}")

# --------------------------------------------------
# 2. VALIDATE REQUIRED COLUMNS
# --------------------------------------------------

FEATURES = [
    "rainfall_24h_mm",
    "rainfall_7d_mm",
    "slope_deg"
]

TARGET = "landslide"

required_columns = FEATURES + [TARGET]

missing_columns = [
    column for column in required_columns
    if column not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Missing required columns: {missing_columns}"
    )

# Remove rows containing missing values
df = df.dropna(subset=required_columns)

print(f"Samples after cleaning: {len(df)}")

# --------------------------------------------------
# 3. CREATE X AND Y
# --------------------------------------------------

X = df[FEATURES]
y = df[TARGET]

print("\nFeatures:")
print(FEATURES)

print("\nTarget distribution:")
print(y.value_counts())

# --------------------------------------------------
# 4. TRAIN / TEST SPLIT
# --------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))

# --------------------------------------------------
# 5. CREATE RANDOM FOREST MODEL
# --------------------------------------------------

model = RandomForestClassifier(
    n_estimators=300,
    max_depth=12,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)

# --------------------------------------------------
# 6. TRAIN
# --------------------------------------------------

print("\nTraining model...")

model.fit(X_train, y_train)

print("Training completed.")

# --------------------------------------------------
# 7. EVALUATE
# --------------------------------------------------

predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("\n==============================")
print("MODEL EVALUATION")
print("==============================")

print(f"\nAccuracy: {accuracy:.4f}")

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        predictions,
        target_names=["No Landslide", "Landslide"]
    )
)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, predictions))

# --------------------------------------------------
# 8. FEATURE IMPORTANCE
# --------------------------------------------------

print("\nFeature Importance:")

for feature, importance in zip(
    FEATURES,
    model.feature_importances_
):
    print(f"{feature}: {importance:.4f}")

# --------------------------------------------------
# 9. SAVE MODEL
# --------------------------------------------------

MODEL_PATH = "landslide_model.pkl"

joblib.dump(model, MODEL_PATH)

print(f"\nModel saved as: {MODEL_PATH}")