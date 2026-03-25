import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchWorkoutHistory } from '../../api/routine';
import './my-routine.css';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function RoutineHistory() {
  const { getIdToken } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = await getIdToken();
        const data = await fetchWorkoutHistory(token);
        if (!cancelled) {
          setWorkouts(data?.workouts || []);
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [getIdToken]);

  if (loading) {
    return (
      <div className="routine-loading">
        <div className="section-spinner" />
        <p>Loading history...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <Link to="/portal/routine" style={{ fontSize: '.88rem', color: 'var(--rock)' }}>&larr; Back to My Routine</Link>
        <h1>Routine History</h1>
        <p>Your past personalized daily workouts</p>
      </div>

      {workouts.length === 0 ? (
        <div className="routine-gate">
          <p>No workout history yet. Generate your first daily workout to get started!</p>
          <Link to="/portal/routine" className="btn primary">Go to My Routine</Link>
        </div>
      ) : (
        <div>
          {workouts.map((w, idx) => (
            <div key={w.date || idx} className="routine-card" style={{ cursor: 'pointer' }}>
              <button
                type="button"
                className="routine-exercise-header"
                onClick={() => setExpanded(expanded === idx ? null : idx)}
                style={{ padding: '8px 0' }}
              >
                <span className={`routine-type-badge ${w.type || 'training'}`}>
                  {w.type === 'rest' ? 'Rest' : w.type === 'active_recovery' ? 'Recovery' : 'Train'}
                </span>
                <div className="routine-exercise-info">
                  <span className="routine-exercise-name">{w.title || 'Workout'}</span>
                  <span className="routine-exercise-prescription">
                    {formatDate(w.date)} {w.duration ? `\u00B7 ${w.duration}` : ''}
                    {w.focus?.length > 0 ? ` \u00B7 ${w.focus.map(t => t.replace(/[-_]/g, ' ')).join(', ')}` : ''}
                  </span>
                </div>
                <span className="routine-exercise-chevron">{expanded === idx ? '\u25B2' : '\u25BC'}</span>
              </button>

              {expanded === idx && (
                <div style={{ paddingTop: 12, borderTop: '1px solid rgba(27,18,10,.06)' }}>
                  {w.exercises?.map((ex, exIdx) => (
                    <div key={exIdx} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0' }}>
                      <span className="routine-exercise-num" style={{ width: 22, height: 22, fontSize: '.7rem' }}>{exIdx + 1}</span>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '.88rem' }}>{ex.exerciseName}</span>
                        <span style={{ color: 'var(--rock)', fontSize: '.82rem', marginLeft: 8 }}>
                          {ex.sets && ex.reps ? `${ex.sets}x${ex.reps}` : ex.duration || ''}
                          {ex.rest ? ` \u00B7 ${ex.rest} rest` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                  {w.coachingNotes && (
                    <p style={{ margin: '10px 0 0', fontSize: '.84rem', color: 'var(--rock)', fontStyle: 'italic' }}>
                      {w.coachingNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
