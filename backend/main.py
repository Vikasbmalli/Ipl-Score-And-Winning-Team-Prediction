from pathlib import Path
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

HERE = Path(__file__).resolve().parent
SCORE_MODEL_PATH = HERE / "score_model.joblib"
WINNER_MODEL_PATH = HERE / "winner_model.joblib"
DATASET_PATH = HERE.parent / "dataset" / "data.csv"
MATCHES_PATH = HERE.parent / "dataset" / "matches.csv"

app = FastAPI(
    title="IPL Prediction API",
    description="Historical IPL innings-score and match-winner prediction demo.",
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

class ScoreRequest(BaseModel):
    venue: str = Field(min_length=1)
    batting_team: str = Field(min_length=1)
    bowling_team: str = Field(min_length=1)
    runs: int = Field(ge=0, le=400)
    wickets: int = Field(ge=0, le=10)
    overs: float = Field(ge=0, le=20)
    runs_last_5: int = Field(ge=0, le=200)
    wickets_last_5: int = Field(ge=0, le=10)

class WinnerRequest(BaseModel):
    team1: str = Field(min_length=1)
    team2: str = Field(min_length=1)
    venue: str = Field(min_length=1)
    toss_winner: str = Field(min_length=1)
    toss_decision: str = Field(min_length=1)

def load_bundle(path):
    return joblib.load(path) if path.exists() else None

@app.get("/")
def root():
    return {"message": "IPL Prediction API is running", "docs": "/docs"}

@app.get("/api/options")
def options():
    if not DATASET_PATH.exists():
        raise HTTPException(status_code=500, detail="dataset/data.csv not found.")
    df = pd.read_csv(DATASET_PATH, usecols=["venue", "batting_team", "bowling_team"])
    teams = sorted(set(df["batting_team"].dropna()) | set(df["bowling_team"].dropna()))
    venues = sorted(df["venue"].dropna().unique().tolist())
    return {"teams": teams, "venues": venues}

@app.get("/api/winner-options")
def winner_options():
    if not MATCHES_PATH.exists():
        raise HTTPException(status_code=404, detail="Add dataset/matches.csv. See dataset/WINNER_DATASET_README.md.")
    df = pd.read_csv(MATCHES_PATH)
    required = ["team1", "team2", "venue", "toss_winner", "toss_decision"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"matches.csv missing columns: {missing}")
    teams = sorted(set(df["team1"].dropna()) | set(df["team2"].dropna()))
    venues = sorted(df["venue"].dropna().unique().tolist())
    toss_decisions = sorted(df["toss_decision"].dropna().astype(str).unique().tolist())
    return {"teams": teams, "venues": venues, "toss_decisions": toss_decisions}

@app.get("/api/model-info")
def model_info():
    score = load_bundle(SCORE_MODEL_PATH)
    winner = load_bundle(WINNER_MODEL_PATH)
    return {
        # Legacy fields consumed by the score panel in the React UI.
        "trained": score is not None,
        "training_rows": score.get("training_rows") if score else None,
        "test_mae_runs": round(score.get("test_mae", 0), 2) if score else None,
        # Explicit fields for both models.
        "score_model_trained": score is not None,
        "winner_model_trained": winner is not None,
        "score_training_rows": score.get("training_rows") if score else None,
        "score_test_mae_runs": round(score.get("test_mae", 0), 2) if score else None,
        "winner_training_rows": winner.get("training_rows") if winner else None,
        "winner_test_accuracy": round(winner.get("test_accuracy", 0), 3) if winner else None,
    }

@app.post("/api/predict")
def predict_score(request: ScoreRequest):
    bundle = load_bundle(SCORE_MODEL_PATH)
    if bundle is None:
        raise HTTPException(status_code=503, detail="Score model missing. Run python train_model.py.")
    if request.batting_team.strip() == request.bowling_team.strip():
        raise HTTPException(status_code=400, detail="Batting and bowling teams must be different.")
    row = pd.DataFrame([request.model_dump()])
    try:
        prediction = float(bundle["model"].predict(row)[0])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Score prediction failed: {exc}") from exc
    return {
        "predicted_total": max(0, round(prediction)),
        "note": "Historical innings-total estimate; not a match-winner prediction.",
    }

@app.post("/api/predict-winner")
def predict_winner(request: WinnerRequest):
    bundle = load_bundle(WINNER_MODEL_PATH)
    if bundle is None:
        raise HTTPException(status_code=503, detail="Winner model missing. Add matches.csv and run python train_winner_model.py.")
    if request.team1.strip() == request.team2.strip():
        raise HTTPException(status_code=400, detail="Choose two different teams.")
    if request.toss_winner not in [request.team1, request.team2]:
        raise HTTPException(status_code=400, detail="Toss winner must be Team 1 or Team 2.")
    row = pd.DataFrame([request.model_dump()])
    try:
        model = bundle["model"]
        probabilities = model.predict_proba(row)[0]
        classes = list(model.named_steps["classifier"].classes_)
        team_probs = {str(team): float(prob) for team, prob in zip(classes, probabilities)}
        p1 = team_probs.get(request.team1, 0.0)
        p2 = team_probs.get(request.team2, 0.0)
        total = p1 + p2
        if total > 0:
            p1, p2 = p1 / total, p2 / total
        winner = request.team1 if p1 >= p2 else request.team2
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Winner prediction failed: {exc}") from exc
    return {
        "predicted_winner": winner,
        "team1": request.team1,
        "team2": request.team2,
        "team1_probability": round(p1 * 100, 1),
        "team2_probability": round(p2 * 100, 1),
        "note": "Historical model estimate, not a guarantee. Teams/seasons change; use as a learning demonstration.",
    }
