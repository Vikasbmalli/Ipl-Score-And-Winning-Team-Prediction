from pathlib import Path
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

HERE = Path(__file__).resolve().parent
DATA_PATH = HERE.parent / "dataset" / "data.csv"
MODEL_PATH = HERE / "score_model.joblib"

CATEGORICAL = ["venue", "batting_team", "bowling_team"]
NUMERIC = [
    "runs", "wickets", "overs", "runs_last_5", "wickets_last_5"
]
FEATURES = CATEGORICAL + NUMERIC
TARGET = "total"

def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_PATH}. Put data.csv in the project dataset folder."
        )

    df = pd.read_csv(DATA_PATH)
    required = FEATURES + [TARGET]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    df = df[required].copy()
    df = df.dropna(subset=required)
    for column in NUMERIC + [TARGET]:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    df = df.dropna(subset=NUMERIC + [TARGET])

    # Keep physically sensible states for a simple demo.
    df = df[(df["overs"] >= 0) & (df["overs"] <= 20)]
    if len(df) < 100:
        raise ValueError("Too few usable rows after cleaning to train a model.")

    X = df[FEATURES]
    y = df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL),
            ("numeric", "passthrough", NUMERIC),
        ]
    )
    model = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", RandomForestRegressor(
            n_estimators=120, min_samples_leaf=2, random_state=42, n_jobs=-1
        )),
    ])

    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    mae = mean_absolute_error(y_test, predictions)

    joblib.dump({
        "model": model,
        "features": FEATURES,
        "categorical": CATEGORICAL,
        "numeric": NUMERIC,
        "target": TARGET,
        "training_rows": int(len(df)),
        "test_mae": float(mae),
    }, MODEL_PATH)

    print(f"Rows used: {len(df):,}")
    print(f"Test MAE: {mae:.2f} runs")
    print(f"Saved model: {MODEL_PATH}")
    print("Note: this model predicts innings total, not match winner.")

if __name__ == "__main__":
    main()
