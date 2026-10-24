"""Train a match-winner classifier from dataset/matches.csv."""
from pathlib import Path
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

HERE = Path(__file__).resolve().parent
DATA_PATH = HERE.parent / "dataset" / "matches.csv"
MODEL_PATH = HERE / "winner_model.joblib"

CAT_FEATURES = ["team1", "team2", "venue", "toss_winner", "toss_decision"]
TARGET = "winner"

def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Could not find {DATA_PATH}. Read dataset/WINNER_DATASET_README.md first."
        )

    df = pd.read_csv(DATA_PATH)
    missing = [c for c in CAT_FEATURES + [TARGET] if c not in df.columns]
    if missing:
        raise ValueError(
            f"Dataset is missing columns {missing}. Found columns: {list(df.columns)}"
        )

    df = df[CAT_FEATURES + [TARGET]].copy()
    df = df.dropna(subset=[TARGET, "team1", "team2", "venue"])
    for c in CAT_FEATURES + [TARGET]:
        df[c] = df[c].astype("string").str.strip()
    df = df[(df["team1"] != "") & (df["team2"] != "") & (df["winner"] != "")]
    df = df[df["winner"].isin(set(df["team1"]) | set(df["team2"]))]
    df = df[df["team1"] != df["team2"]]

    if len(df) < 100:
        raise ValueError(f"Only {len(df)} usable matches. Check matches.csv.")

    # Random stratified split provides a basic baseline; a time-based split is
    # preferable for a rigorous evaluation of future-season performance.
    X = df[CAT_FEATURES]
    y = df[TARGET]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    preprocessor = ColumnTransformer([
        ("categorical", Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]), CAT_FEATURES)
    ])
    model = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(max_iter=3000, class_weight="balanced")),
    ])
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    accuracy = accuracy_score(y_test, preds)
    print(f"Matches used: {len(df):,}")
    print(f"Random holdout accuracy: {accuracy:.3f}")
    print(classification_report(y_test, preds, zero_division=0))

    joblib.dump({
        "model": model,
        "features": CAT_FEATURES,
        "classes": list(model.named_steps["classifier"].classes_),
        "training_rows": int(len(df)),
        "test_accuracy": float(accuracy),
    }, MODEL_PATH)
    print(f"Saved winner model: {MODEL_PATH}")
    print("Note: this is a historical baseline, not a guarantee of future match outcomes.")

if __name__ == "__main__":
    main()
