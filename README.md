<div align="center">

# 🏏 BoundaryIQ — IPL Prediction Studio

**Explore a match situation. See what historical IPL data suggests.**

A full-stack machine-learning project with separate models for estimating an innings total and predicting a match winner.

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/UI-React-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&logoColor=white)

</div>

---

## ✨ What it does

BoundaryIQ combines a React interface with a FastAPI service and two scikit-learn pipelines:

- **Innings score estimate** — estimates a first-innings total from the venue, batting and bowling teams, current runs and wickets, overs played, and recent five-over performance.
- **Match winner estimate** — compares two teams using the venue and toss information, and returns a predicted winner with estimated probabilities.
- **Live data-driven options** — the API reads teams and venues from the CSV files so the interface's dropdowns reflect the available data.
- **Model information** — shows whether each trained model is available and reports its training-set size and holdout metric.
- **Prediction history** — keeps predictions made during the current browser session.

> **A learning project, not a betting or forecasting service.** Predictions are historical model estimates, not guarantees. Team names, players, rules, and conditions change over time.

## 🧰 Technology

| Area | Tools |
| --- | --- |
| Frontend | React 18, Vite, lucide-react |
| Backend | Python, FastAPI, Uvicorn, Pydantic |
| Machine learning | pandas, scikit-learn, joblib |
| Data | CSV datasets in `dataset/` |

## 📁 Project layout

```text
.
├── backend/
│   ├── main.py                  # FastAPI endpoints
│   ├── train_model.py           # Train the innings-score regressor
│   ├── train_winner_model.py    # Train the match-winner classifier
│   └── requirements.txt
├── dataset/
│   ├── data.csv                 # Ball-by-ball/innings data for score estimates
│   ├── matches.csv              # Match-level data for winner estimates
│   └── WINNER_DATASET_README.md # Winner dataset notes
└── frontend/
    ├── src/                     # React app and styles
    ├── package.json
    └── index.html
```

Trained `*.joblib` model files are generated locally and intentionally excluded from Git. In particular, the supplied score model file is over GitHub's regular 100 MB file limit. Train the models after cloning by following the setup below.

## 🚀 Run locally

### Prerequisites

- Python **3.10 or newer**
- Node.js **18 or newer** and npm
- Git

### 1. Get the project and prepare the Python environment

Run these commands from the project root in PowerShell:

```powershell
python -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

If PowerShell prevents activation, open Command Prompt and run:

```bat
backend\.venv\Scripts\activate.bat
```

### 2. Train both models

From the project root, run:

```powershell
python backend\train_model.py
python backend\train_winner_model.py
```

The scripts create `backend/score_model.joblib` and `backend/winner_model.joblib`. Training uses the CSV files included in `dataset/`. The winner dataset's expected columns and source note are documented in [`dataset/WINNER_DATASET_README.md`](dataset/WINNER_DATASET_README.md).

### 3. Install frontend dependencies

In a terminal at the project root:

```powershell
cd frontend
npm ci
```

### 4. Start the API and website

Keep both services running in separate terminals.

**Terminal 1 — from the project root, with the Python environment active:**

```powershell
python -m uvicorn main:app --reload --app-dir backend
```

The API is at `http://127.0.0.1:8000`; interactive API documentation is at `http://127.0.0.1:8000/docs`.

**Terminal 2 — from the `frontend` directory:**

```powershell
npm run dev
```

Open the local address printed by Vite (normally `http://localhost:5173`).

## 🔌 API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/` | API status |
| `GET` | `/api/options` | Teams and venues for score prediction |
| `GET` | `/api/winner-options` | Teams, venues, and toss choices for winner prediction |
| `GET` | `/api/model-info` | Model readiness and evaluation information |
| `POST` | `/api/predict` | Predict an innings total |
| `POST` | `/api/predict-winner` | Estimate the match winner and team probabilities |

The score prediction request accepts `venue`, `batting_team`, `bowling_team`, `runs`, `wickets`, `overs`, `runs_last_5`, and `wickets_last_5`. The winner request accepts `team1`, `team2`, `venue`, `toss_winner`, and `toss_decision`. Visit `/docs` for interactive request schemas.

## 📊 Models and interpretation

### Innings score model

A `RandomForestRegressor` pipeline one-hot encodes venue and team names and combines them with the innings state. The training script prints the number of usable rows and mean absolute error (MAE) on a random 80/20 holdout split. MAE is measured in runs; a lower value means smaller average absolute errors on that test split.

### Match winner model

A class-weighted `LogisticRegression` pipeline uses only pre-match features: the two teams, venue, toss winner, and toss decision. The script prints accuracy and a classification report on a random stratified 80/20 holdout split. The split is a simple baseline, not a time-based evaluation, so its result should not be treated as proof of future-season accuracy.

The datasets and trained models may not represent current squads, formats, or conditions. Do not interpret model probabilities as certainty.

## 🗃️ Data and generated files

- Keep `dataset/data.csv` and `dataset/matches.csv` in place; the API and training scripts read them using these paths.
- `matches.csv` must include `team1`, `team2`, `venue`, `toss_winner`, `toss_decision`, and `winner`. See the dataset notes for more details.
- The score and winner model files are ignored by Git because they are generated artifacts. Recreate them by running both training commands after installing dependencies.
- Python virtual environments, frontend dependencies, build output, and local environment files are also excluded by [`.gitignore`](.gitignore).

## 🧪 Development

Build the frontend production bundle from the `frontend` directory:

```powershell
npm run build
```

Preview that bundle locally with:

```powershell
npm run preview
```

## ☁️ Publish to GitHub

Create an empty repository on GitHub (without adding an initial README or license), then run these commands from the project root. Replace the remote URL with your repository's URL:

```powershell
git init
git add .
git status --short
git commit -m "Add IPL prediction project"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repository>.git
git push -u origin main
```

Before committing, check `git status --short` to confirm the virtual environment, `node_modules`, build output, and generated model files are not staged. The CSV datasets are included; confirm their redistribution terms before publishing.

## 📜 Credits and usage

The winner-dataset instructions point to the public [IPL Analytics repository](https://github.com/avinashyadav16/ipl-analytics) as a source for match-level data. Check that source's terms and attribution requirements before redistributing its data. The score dataset's original source and license should likewise be confirmed before redistribution.

This project is intended for learning and demonstration. It is not affiliated with the Indian Premier League, the BCCI, or any IPL team.
