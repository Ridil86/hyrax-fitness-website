import { useState } from 'react';
import { createWorkoutLog } from '../api/completionLog';
import { trackWorkoutComplete, trackExerciseComplete } from '../utils/analytics';
import './completion-form.css';

const RPE_OPTIONS = [
  { value: '', label: 'RPE (optional)' },
  { value: '1', label: '1 - Very Light' },
  { value: '2', label: '2 - Light' },
  { value: '3', label: '3 - Light-Moderate' },
  { value: '4', label: '4 - Moderate' },
  { value: '5', label: '5 - Moderate-Hard' },
  { value: '6', label: '6 - Hard' },
  { value: '7', label: '7 - Very Hard' },
  { value: '8', label: '8 - Very Hard+' },
  { value: '9', label: '9 - Near Maximum' },
  { value: '10', label: '10 - Maximum' },
];

export default function CompletionForm({
  exercises,
  source,
  sourceId,
  workoutId,
  workoutTitle,
  onComplete,
  getIdToken,
}) {
  const [rows, setRows] = useState(
    exercises.map((ex) => ({
      ...ex,
      sets: Number(ex.sets) || 1,
      reps: Number(ex.reps) || 0,
      weight: '',
      weightUnit: 'lbs',
      rpe: '',
      notes: '',
    }))
  );
  const [durationMinutes, setDurationMinutes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  function updateRow(index, field, value) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const token = await getIdToken();
      const payload = {
        workoutId,
        workoutTitle,
        exercises: rows.map((row) => ({
          exerciseId: row.exerciseId,
          exerciseName: row.exerciseName,
          difficulty: row.difficulty,
          sets: row.sets,
          reps: row.reps,
          weight: row.weight || undefined,
          weightUnit: row.weightUnit,
          rpe: row.rpe || undefined,
          notes: row.notes,
        })),
        source,
        sourceId,
        workoutDuration: durationMinutes ? Number(durationMinutes) * 60 : undefined,
      };

      await createWorkoutLog(payload, token);

      // Analytics: track completion
      if (workoutId) {
        trackWorkoutComplete(workoutId, rows.length, rows[0]?.difficulty);
      }
      rows.forEach((row) => {
        trackExerciseComplete(row.exerciseId, row.exerciseName, row.difficulty, row.rpe);
      });

      setSuccess(true);
      setRows(
        exercises.map((ex) => ({
          ...ex,
          sets: Number(ex.sets) || 1,
          reps: Number(ex.reps) || 0,
          weight: '',
          weightUnit: 'lbs',
          rpe: '',
          notes: '',
        }))
      );
      setDurationMinutes('');
      if (onComplete) onComplete();
    } catch (err) {
      setError(err.message || 'Failed to log completion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="completion-form" onSubmit={handleSubmit}>
      <h3>Log Workout Completion</h3>

      <div className="completion-form-duration">
        <label htmlFor="cf-duration">Duration</label>
        <input
          id="cf-duration"
          type="number"
          min="0"
          placeholder="0"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
        <span>minutes</span>
      </div>

      <div className="completion-form-rows">
        {rows.map((row, i) => (
          <div key={row.exerciseId || i} className="completion-form-row">
            <div className="completion-form-row-header">
              <span className="completion-form-name">{row.exerciseName}</span>
              {row.difficulty && (
                <span className="completion-form-difficulty">{row.difficulty}</span>
              )}
            </div>

            <div className="completion-form-fields">
              <div className="completion-form-field">
                <label>Sets</label>
                <input
                  type="number"
                  min="1"
                  value={row.sets}
                  onChange={(e) => updateRow(i, 'sets', Number(e.target.value))}
                />
              </div>

              <div className="completion-form-field">
                <label>Reps</label>
                <input
                  type="number"
                  min="0"
                  value={row.reps}
                  onChange={(e) => updateRow(i, 'reps', Number(e.target.value))}
                />
              </div>

              <div className="completion-form-field">
                <label>Weight</label>
                <div className="completion-form-weight-group">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={row.weight}
                    onChange={(e) => updateRow(i, 'weight', e.target.value)}
                  />
                  <select
                    value={row.weightUnit}
                    onChange={(e) => updateRow(i, 'weightUnit', e.target.value)}
                  >
                    <option value="lbs">lbs</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div className="completion-form-field">
                <label>RPE</label>
                <select
                  value={row.rpe}
                  onChange={(e) => updateRow(i, 'rpe', e.target.value)}
                >
                  {RPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="completion-form-field completion-form-notes">
                <label>Notes</label>
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={row.notes}
                  onChange={(e) => updateRow(i, 'notes', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="completion-form-submit">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Logging...' : 'Log Completion'}
        </button>
        {success && (
          <span className="completion-form-success">Workout logged!</span>
        )}
      </div>

      {error && <div className="completion-form-error">{error}</div>}
    </form>
  );
}
