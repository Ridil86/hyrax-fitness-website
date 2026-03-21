import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createExerciseLog } from '../../api/completionLog';
import { hasTierAccess } from '../../utils/tiers';
import { apiGet } from '../../api/client';
import './benchmarks.css';

const STANDARD_BENCHMARKS = [
  { exerciseId: 'boulder-press', name: 'Boulder Press Max', metric: 'reps', description: 'Max reps in 2 minutes' },
  { exerciseId: 'bolt-sprint', name: 'Bolt Sprint', metric: 'duration', description: 'Best time (seconds)' },
  { exerciseId: 'perch-squat', name: 'Perch Squat Max', metric: 'weight', description: 'Max weight (1RM)' },
  { exerciseId: 'crag-pull', name: 'Crag Pull Max', metric: 'reps', description: 'Max reps in 2 minutes' },
  { exerciseId: 'sunstone-hold', name: 'Sunstone Hold', metric: 'duration', description: 'Max hold time (seconds)' },
];

export default function Benchmarks() {
  const { getIdToken, userTier } = useAuth();
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ exerciseId: '', exerciseName: '', value: '', metric: 'reps', notes: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const hasAccess = hasTierAccess(userTier, 'Rock Runner');

  const loadBenchmarks = useCallback(async () => {
    try {
      const token = await getIdToken();
      const data = await apiGet('/api/logs/benchmarks', token);
      if (data?.benchmarks) setBenchmarks(data.benchmarks);
    } catch {
      // best-effort
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    if (hasAccess) loadBenchmarks();
    else setLoading(false);
  }, [hasAccess, loadBenchmarks]);

  const handleSubmit = async () => {
    if (!formData.exerciseId || !formData.value) return;
    setSaving(true);
    setMessage(null);
    try {
      const token = await getIdToken();
      const logData = {
        exerciseId: formData.exerciseId,
        exerciseName: formData.exerciseName,
        type: 'benchmark',
        source: 'benchmark',
        notes: formData.notes || '',
      };
      if (formData.metric === 'weight') {
        logData.weight = Number(formData.value);
        logData.sets = 1;
        logData.reps = 1;
      } else if (formData.metric === 'reps') {
        logData.reps = Number(formData.value);
        logData.sets = 1;
      } else if (formData.metric === 'duration') {
        logData.duration = Number(formData.value);
        logData.sets = 1;
        logData.reps = 1;
      }
      await createExerciseLog(logData, token);
      setMessage({ type: 'success', text: 'Benchmark recorded!' });
      setShowForm(false);
      setFormData({ exerciseId: '', exerciseName: '', value: '', metric: 'reps', notes: '' });
      await loadBenchmarks();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save benchmark' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 0', color: 'var(--rock)' }}>
        <div className="section-spinner" />
        <p>Loading benchmarks...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>Benchmarks</h1>
          <p>Track your fitness milestones</p>
        </div>
        <div className="bench-gate">
          <div style={{ fontSize: '2.4rem', marginBottom: 12 }}>&#x1F3C6;</div>
          <h2>Upgrade to Unlock</h2>
          <p>Benchmark tracking is available for Rock Runner and Iron Dassie members.</p>
          <Link to="/portal/subscription" className="btn primary">View Plans</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>Benchmarks</h1>
        <p>Track your fitness milestones and personal records</p>
      </div>

      {message && (
        <div className={`bench-msg ${message.type}`}>{message.text}</div>
      )}

      <div className="bench-actions">
        <button className="btn primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Record Benchmark'}
        </button>
      </div>

      {showForm && (
        <div className="bench-card bench-form">
          <h3>Record a Benchmark</h3>
          <div className="bench-form-grid">
            <div className="bench-field">
              <label>Exercise</label>
              <select
                value={formData.exerciseId}
                onChange={(e) => {
                  const sb = STANDARD_BENCHMARKS.find(b => b.exerciseId === e.target.value);
                  setFormData({
                    ...formData,
                    exerciseId: e.target.value,
                    exerciseName: sb?.name || e.target.value,
                    metric: sb?.metric || 'reps',
                  });
                }}
                className="bench-select"
              >
                <option value="">Select exercise...</option>
                {STANDARD_BENCHMARKS.map((b) => (
                  <option key={b.exerciseId} value={b.exerciseId}>
                    {b.name} ({b.description})
                  </option>
                ))}
              </select>
            </div>
            <div className="bench-field">
              <label>Value ({formData.metric === 'weight' ? 'lbs' : formData.metric === 'duration' ? 'seconds' : 'reps'})</label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="Enter value"
                className="bench-input"
                min={0}
              />
            </div>
            <div className="bench-field">
              <label>Notes (optional)</label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., felt strong, used strict form"
                className="bench-input"
              />
            </div>
          </div>
          <button className="btn primary" onClick={handleSubmit} disabled={!formData.exerciseId || !formData.value || saving}>
            {saving ? 'Saving...' : 'Save Benchmark'}
          </button>
        </div>
      )}

      {benchmarks.length === 0 ? (
        <div className="bench-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: 'var(--rock)', margin: 0 }}>No benchmarks recorded yet. Click &ldquo;Record Benchmark&rdquo; to get started!</p>
        </div>
      ) : (
        <div className="bench-list">
          {benchmarks.map((b) => {
            const latest = b.entries[b.entries.length - 1];
            const best = b.entries.reduce((max, e) => e.value > max.value ? e : max, b.entries[0]);
            return (
              <div key={b.exerciseId} className="bench-card">
                <div className="bench-card-header">
                  <h3>{b.exerciseName}</h3>
                  <span className="bench-entry-count">{b.entries.length} {b.entries.length === 1 ? 'entry' : 'entries'}</span>
                </div>
                <div className="bench-stats">
                  <div className="bench-stat">
                    <span className="bench-stat-label">Latest</span>
                    <span className="bench-stat-value">{latest.value} {latest.unit}</span>
                    <span className="bench-stat-date">{latest.date}</span>
                  </div>
                  <div className="bench-stat">
                    <span className="bench-stat-label">Personal Best</span>
                    <span className="bench-stat-value bench-pb">{best.value} {best.unit}</span>
                    <span className="bench-stat-date">{best.date}</span>
                  </div>
                </div>
                {b.entries.length > 1 && (
                  <div className="bench-history">
                    {b.entries.map((e, idx) => (
                      <span key={idx} className="bench-history-dot" title={`${e.date}: ${e.value} ${e.unit}`}>
                        {e.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
