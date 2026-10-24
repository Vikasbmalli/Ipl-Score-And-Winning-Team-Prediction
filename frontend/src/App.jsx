import React, { useEffect, useState } from 'react';
import { Activity, BrainCircuit, CircleAlert, LoaderCircle, Trophy } from 'lucide-react';

const API = 'http://127.0.0.1:8000';

const analysisStages = [
  'Validating match inputs',
  'Preparing team and venue data',
  'Building innings features',
  'Running the prediction model',
  'Finalizing the estimated total',
];

const initialForm = {
  venue: '',
  batting_team: '',
  bowling_team: '',
  runs: 80,
  wickets: 3,
  overs: 10,
  runs_last_5: 42,
  wickets_last_5: 1,
};

export default function App() {
  const [options, setOptions] = useState({ teams: [], venues: [] });
  const [form, setForm] = useState(initialForm);
  const [modelInfo, setModelInfo] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [winnerOptions, setWinnerOptions] = useState({ teams: [], venues: [], toss_decisions: [] });
  const [winnerForm, setWinnerForm] = useState({ team1: '', team2: '', venue: '', toss_winner: '', toss_decision: '' });
  const [winnerResult, setWinnerResult] = useState(null);
  const [winnerLoading, setWinnerLoading] = useState(false);
  const [winnerError, setWinnerError] = useState('');
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState(analysisStages[0]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/options`).then((r) => {
        if (!r.ok) throw new Error('Could not load teams and venues. Is the backend running?');
        return r.json();
      }),
      fetch(`${API}/api/model-info`).then((r) => r.json()),
    ])
      .then(([data, info]) => {
        setOptions(data);
        setModelInfo(info);
        setForm((old) => ({
          ...old,
          venue: data.venues.includes('M Chinnaswamy Stadium')
            ? 'M Chinnaswamy Stadium'
            : (data.venues[0] || ''),
          batting_team: data.teams.includes('Royal Challengers Bangalore')
            ? 'Royal Challengers Bangalore'
            : (data.teams[0] || ''),
          bowling_team: data.teams.includes('Chennai Super Kings')
            ? 'Chennai Super Kings'
            : (data.teams[1] || data.teams[0] || ''),
        }));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    fetch(`${API}/api/winner-options`)
      .then((r) => {
        if (!r.ok) throw new Error('Winner dataset not installed yet.');
        return r.json();
      })
      .then((data) => {
        setWinnerOptions(data);
        const team1 = data.teams[0] || '';
        const team2 = data.teams.find((t) => t !== team1) || '';
        setWinnerForm({
          team1,
          team2,
          venue: data.venues[0] || '',
          toss_winner: team1,
          toss_decision: data.toss_decisions.includes('field') ? 'field' : (data.toss_decisions[0] || ''),
        });
      })
      .catch(() => {
        // Score prediction can still be used until matches.csv is added and the winner model is trained.
      });
  }, []);

  function update(field, value) {
    setForm((old) => ({ ...old, [field]: value }));
  }

  async function submitWinner(e) {
    e.preventDefault();
    setWinnerLoading(true);
    setWinnerError('');
    setWinnerResult(null);
    const submittedForm = { ...winnerForm };
    try {
      const response = await fetch(`${API}/api/predict-winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submittedForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Winner prediction failed.');
      setWinnerResult(data);
      setPredictionHistory((history) => [{
        id: Date.now(),
        type: 'winner',
        form: submittedForm,
        result: data,
        createdAt: new Date().toISOString(),
      }, ...history]);
    } catch (e) {
      setWinnerError(e.message || 'Could not reach the winner prediction API.');
    } finally {
      setWinnerLoading(false);
    }
  }

  function updateWinner(field, value) {
    setWinnerForm((old) => {
      const next = { ...old, [field]: value };
      if (field === 'team1' && next.toss_winner !== value && next.toss_winner !== next.team2) next.toss_winner = value;
      if (field === 'team2' && next.toss_winner !== value && next.toss_winner !== next.team1) next.toss_winner = value;
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setIsAnalyzing(true);
    setProgress(0);
    setProgressStep(analysisStages[0]);
    setError('');
    setResult(null);
    const submittedForm = {
      ...form,
      runs: Number(form.runs),
      wickets: Number(form.wickets),
      overs: Number(form.overs),
      runs_last_5: Number(form.runs_last_5),
      wickets_last_5: Number(form.wickets_last_5),
    };
    let currentProgress = 0;
    const progressTimer = window.setInterval(() => {
      currentProgress = Math.min(currentProgress + 5, 90);
      setProgress(currentProgress);
      setProgressStep(analysisStages[Math.min(Math.floor(currentProgress / 20), analysisStages.length - 1)]);
    }, 180);
    try {
      const response = await fetch(`${API}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submittedForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Prediction request failed.');
      setResult(data);
      setPredictionHistory((history) => [{
        id: Date.now(),
        type: 'innings',
        form: submittedForm,
        result: data,
        createdAt: new Date().toISOString(),
      }, ...history]);
      window.clearInterval(progressTimer);
      setProgress(100);
      setProgressStep('Prediction complete');
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    } catch (e) {
      setError(e.message || 'Unable to contact the API.');
    } finally {
      window.clearInterval(progressTimer);
      setLoading(false);
      setIsAnalyzing(false);
    }
  }

  const teamsReady = options.teams.length > 0;
  const venuesReady = options.venues.length > 0;

  return (
    <main className="page-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-icon"><Trophy size={21} /></div><span>Boundary<span className="brand-accent">IQ</span></span></div>
        <span className="status"><span className="status-dot" /> ML WORKSPACE</span>
      </header>

      <section className="hero">
        <div className="eyebrow"><Activity size={15} /> MACHINE LEARNING PROJECT</div>
        <h1>IPL Prediction<br /><span>Studio.</span></h1>
        <p className="hero-copy">Explore match conditions and estimate an innings total using a machine learning model trained on historical IPL ball-by-ball data.</p>
        <div className="hero-tags"><span>Python + scikit-learn</span><span>FastAPI</span><span>React</span></div>
      </section>

      <section className="dashboard">
        <div className="panel form-panel">
          <div className="panel-heading">
            <div><span className="step-label">PREDICTION INPUT</span><h2>Match situation</h2></div>
            <div className="panel-icon"><BrainCircuit size={21} /></div>
          </div>
          <form onSubmit={submit}>
            <div className="field-grid">
              <label className="field full"><span>STADIUM / VENUE</span>
                <select value={form.venue} onChange={(e) => update('venue', e.target.value)} required disabled={!venuesReady}>
                  {options.venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
                </select>
              </label>
              <label className="field"><span>BATTING TEAM</span>
                <select value={form.batting_team} onChange={(e) => update('batting_team', e.target.value)} required disabled={!teamsReady}>
                  {options.teams.map((team) => <option key={team} value={team}>{team}</option>)}
                </select>
              </label>
              <label className="field"><span>BOWLING TEAM</span>
                <select value={form.bowling_team} onChange={(e) => update('bowling_team', e.target.value)} required disabled={!teamsReady}>
                  {options.teams.map((team) => <option key={team} value={team}>{team}</option>)}
                </select>
              </label>
            </div>

            <div className="section-divider"><span>INNINGS PROGRESS</span><span>LIVE STATE</span></div>
            <div className="field-grid metrics-grid">
              <label className="field"><span>CURRENT RUNS</span><input type="number" min="0" max="400" value={form.runs} onChange={(e) => update('runs', e.target.value)} required /></label>
              <label className="field"><span>WICKETS LOST</span><input type="number" min="0" max="10" value={form.wickets} onChange={(e) => update('wickets', e.target.value)} required /></label>
              <label className="field"><span>OVERS COMPLETED</span><input type="number" min="0" max="20" step="0.1" value={form.overs} onChange={(e) => update('overs', e.target.value)} required /></label>
              <label className="field"><span>RUNS — LAST 5 OVERS</span><input type="number" min="0" max="200" value={form.runs_last_5} onChange={(e) => update('runs_last_5', e.target.value)} required /></label>
              <label className="field full"><span>WICKETS — LAST 5 OVERS</span><input type="number" min="0" max="10" value={form.wickets_last_5} onChange={(e) => update('wickets_last_5', e.target.value)} required /></label>
            </div>
            <button className="predict-button" type="submit" disabled={loading || !teamsReady || !venuesReady}>
              {loading ? <><LoaderCircle className="spin" size={18} /> Predicting…</> : <><BrainCircuit size={18} /> Estimate innings total</>}
            </button>
          </form>
          {isAnalyzing && <div className="analysis-progress" aria-live="polite">
            <div className="analysis-progress-heading">
              <div><span className="step-label">ANALYSIS PROCESS</span><p>{progressStep}</p></div>
              <strong>{progress}%</strong>
            </div>
            <div
              className="analysis-progress-track"
              role="progressbar"
              aria-label="Prediction analysis progress"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <ol className="analysis-stages">
              {analysisStages.map((stage, index) => {
                const currentStage = analysisStages.indexOf(progressStep);
                const complete = progress === 100 || index < currentStage;
                const active = progress !== 100 && index === currentStage;
                return <li key={stage} className={complete ? 'complete' : active ? 'active' : ''}>{stage}</li>;
              })}
            </ol>
          </div>}
          {error && <div className="message error"><CircleAlert size={18} /><span>{error}</span></div>}
        </div>

        <aside className="result-panel">
          <div className="result-top"><span className="step-label">MODEL OUTPUT</span><span className="live-pill">ESTIMATE</span></div>
          <div className="result-icon"><Trophy size={27} /></div>
          <p className="result-label">Predicted innings total</p>
          <div className="score">{result ? result.predicted_total : '—'}<span>{result ? ' runs' : ' runs'}</span></div>
          {result ? (
            <div className="result-success">
              <div className="result-matchup"><span>{form.batting_team}</span><b>vs</b><span>{form.bowling_team}</span></div>
              <p>{result.note}</p>
            </div>
          ) : (
            <p className="result-hint">Enter a match situation and run the model to see an estimated total.</p>
          )}
          <div className="result-footer">
            <div><span className="footer-dot" /> <span>Model status</span></div>
            <strong>{modelInfo?.trained ? 'READY' : 'WAITING FOR MODEL'}</strong>
          </div>
          {modelInfo?.trained && <div className="model-stats"><div><span>Training rows</span><b>{Number(modelInfo.training_rows).toLocaleString('en-IN')}</b></div><div><span>Test MAE</span><b>{modelInfo.test_mae_runs} runs</b></div></div>}
        </aside>
      </section>


      <section className="panel winner-panel">
        <div className="panel-heading">
          <div><span className="step-label">SECOND ML MODEL</span><h2>Match winner prediction</h2></div>
          <div className="panel-icon"><Trophy size={21} /></div>
        </div>
        <p className="winner-intro">Choose the two teams and match conditions. This model uses historical match outcomes to estimate which team is more likely to win.</p>
        <form onSubmit={submitWinner}>
          <div className="field-grid">
            <label className="field"><span>TEAM 1</span>
              <select value={winnerForm.team1} onChange={(e) => updateWinner('team1', e.target.value)} required disabled={!winnerOptions.teams.length}>
                {winnerOptions.teams.map((team) => <option key={team} value={team}>{team}</option>)}
              </select>
            </label>
            <label className="field"><span>TEAM 2</span>
              <select value={winnerForm.team2} onChange={(e) => updateWinner('team2', e.target.value)} required disabled={!winnerOptions.teams.length}>
                {winnerOptions.teams.filter((team) => team !== winnerForm.team1).map((team) => <option key={team} value={team}>{team}</option>)}
              </select>
            </label>
            <label className="field full"><span>VENUE</span>
              <select value={winnerForm.venue} onChange={(e) => updateWinner('venue', e.target.value)} required disabled={!winnerOptions.venues.length}>
                {winnerOptions.venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
              </select>
            </label>
            <label className="field"><span>TOSS WINNER</span>
              <select value={winnerForm.toss_winner} onChange={(e) => updateWinner('toss_winner', e.target.value)} required>
                {[winnerForm.team1, winnerForm.team2].filter(Boolean).map((team) => <option key={team} value={team}>{team}</option>)}
              </select>
            </label>
            <label className="field"><span>TOSS DECISION</span>
              <select value={winnerForm.toss_decision} onChange={(e) => updateWinner('toss_decision', e.target.value)} required>
                {winnerOptions.toss_decisions.map((decision) => <option key={decision} value={decision}>{decision}</option>)}
                {!winnerOptions.toss_decisions.length && <><option value="bat">bat</option><option value="field">field</option></>}
              </select>
            </label>
          </div>
          <button className="predict-button" type="submit" disabled={winnerLoading || !winnerOptions.teams.length}>
            {winnerLoading ? <><LoaderCircle className="spin" size={18} /> Predicting winner…</> : <><Trophy size={18} /> Predict match winner</>}
          </button>
        </form>
        {!winnerOptions.teams.length && <div className="message error"><CircleAlert size={18} /><span>Add <code>dataset/matches.csv</code> and train the winner model to enable this form. See <code>dataset/WINNER_DATASET_README.md</code>.</span></div>}
        {winnerError && <div className="message error"><CircleAlert size={18} /><span>{winnerError}</span></div>}
        {winnerResult && <div className="winner-output">
          <span className="step-label">MODEL ESTIMATE</span>
          <h3>{winnerResult.predicted_winner}</h3>
          <div className="probability-row"><span>{winnerResult.team1}</span><strong>{winnerResult.team1_probability}%</strong></div>
          <div className="probability-track"><span style={{ width: `${winnerResult.team1_probability}%` }} /></div>
          <div className="probability-row"><span>{winnerResult.team2}</span><strong>{winnerResult.team2_probability}%</strong></div>
          <div className="probability-track"><span style={{ width: `${winnerResult.team2_probability}%` }} /></div>
          <p>{winnerResult.note}</p>
        </div>}
      </section>

      {predictionHistory.length > 0 && <section className="panel history-panel" aria-live="polite">
        <div className="panel-heading">
          <div><span className="step-label">THIS SESSION</span><h2>Previous predictions</h2></div>
          <span className="history-count">{predictionHistory.length} saved</span>
        </div>
        <ol className="history-list">
          {predictionHistory.map((record) => (
            <li className="history-item" key={record.id}>
              <div className="history-item-heading">
                <span className="history-type">{record.type === 'innings' ? 'INNINGS SCORE' : 'MATCH WINNER'}</span>
                <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString()}</time>
              </div>
              {record.type === 'innings' ? (
                <>
                  <strong className="history-result">{record.result.predicted_total} runs</strong>
                  <p>{record.form.batting_team} vs {record.form.bowling_team} · {record.form.venue}</p>
                  <p className="history-details">{record.form.runs} runs after {record.form.overs} overs · {record.form.wickets} wickets</p>
                </>
              ) : (
                <>
                  <strong className="history-result">{record.result.predicted_winner} predicted to win</strong>
                  <p>{record.result.team1} vs {record.result.team2} · {record.form.venue}</p>
                  <p className="history-details">Toss: {record.form.toss_winner} chose to {record.form.toss_decision} · Win chance: {record.result.predicted_winner === record.result.team1 ? record.result.team1_probability : record.result.team2_probability}%</p>
                </>
              )}
            </li>
          ))}
        </ol>
      </section>}

      <section className="notice">
        <CircleAlert size={19} />
        <div><strong>Project scope note</strong><p>Both models provide estimates from historical IPL data, not guarantees. Team rosters, rules, and match conditions change over time, so treat predictions as a learning demonstration.</p></div>
      </section>
      <footer><span>BoundaryIQ · Student ML Project</span><span>Built with React + FastAPI</span></footer>
    </main>
  );
}
