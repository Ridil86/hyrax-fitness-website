import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { fetchWorkout } from '../api/workouts';
import { downloadWorkoutPdf } from '../utils/workoutPdf';
import { hasTierAccess, getRequiredTierInfo } from '../utils/tiers';
import './workout-detail.css';

const DIFFICULTY_STARS = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  elite: 4,
};

export default function WorkoutDetail() {
  const { id } = useParams();
  const { getIdToken, userTier, isAdmin } = useAuth();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getIdToken();
        const data = await fetchWorkout(id, token);
        if (!cancelled) setWorkout(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, getIdToken]);

  if (loading) {
    return (
      <div className="workout-detail">
        <div className="wrap">
          <div className="workout-detail-loading">
            <div className="section-spinner" />
            <p>Loading workout...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !workout) {
    return (
      <div className="workout-detail">
        <div className="wrap">
          <div className="workout-detail-error">
            <h2>Workout Not Found</h2>
            <p>{error || 'This workout may have been removed or is not yet published.'}</p>
            <Link to="/portal/workouts" className="btn primary">
              Back to Library
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stars = DIFFICULTY_STARS[workout.difficulty] || 2;
  const locked = !isAdmin && !hasTierAccess(userTier, workout.requiredTier);
  const requiredInfo = locked ? getRequiredTierInfo(workout.requiredTier) : null;

  return (
    <div className="workout-detail">
      {/* Hero */}
      <div
        className="workout-detail-hero"
        style={
          workout.imageUrl
            ? { backgroundImage: `linear-gradient(rgba(27,18,10,.65), rgba(27,18,10,.85)), url(${workout.imageUrl})` }
            : undefined
        }
      >
        <div className="wrap">
          <Link to="/portal/workouts" className="workout-detail-back">
            &#8592; Back to Library
          </Link>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            {workout.title}
          </motion.h1>

          <motion.div
            className="workout-detail-hero-meta"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
          >
            <span className="workout-detail-badge">{workout.category}</span>
            <span className="workout-detail-badge">{workout.difficulty}</span>
            {workout.duration && (
              <span className="workout-detail-badge">&#9201; {workout.duration}</span>
            )}
            <span className="workout-detail-stars">
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i} className={i < stars ? 'filled' : ''}>
                  &#9733;
                </span>
              ))}
            </span>
          </motion.div>
        </div>
      </div>

      <div className="wrap">
        {locked ? (
          <motion.div
            className="workout-detail-locked"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="workout-locked-card">
              <span className="workout-locked-icon">&#128274;</span>
              <h2>Premium Content</h2>
              <p>
                This workout requires the{' '}
                <strong>{requiredInfo.label}</strong> tier ({requiredInfo.price})
                or higher to access.
              </p>
              <p className="workout-locked-sub">
                Upgrade your plan to unlock this workout, including full
                exercise details and a downloadable PDF.
              </p>
              <div className="workout-locked-actions">
                <Link to="/programs" className="btn primary">
                  View Plans &amp; Upgrade
                </Link>
                <Link to="/portal/workouts" className="btn ghost">
                  Back to Library
                </Link>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="workout-detail-layout">
            {/* Main content */}
            <div className="workout-detail-main">
              {/* Description */}
              {workout.description && (
                <motion.section
                  className="workout-detail-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                >
                  <p className="workout-detail-desc">{workout.description}</p>
                </motion.section>
              )}

              {/* Exercises */}
              {workout.exercises && workout.exercises.length > 0 && (
                <motion.section
                  className="workout-detail-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <h2>Exercises</h2>
                  <div className="workout-exercises-list">
                    {workout.exercises.map((exercise, i) => (
                      <div key={i} className="workout-exercise-item">
                        <div className="workout-exercise-number">{i + 1}</div>
                        <div className="workout-exercise-content">
                          <h3>{exercise.name}</h3>

                          <div className="workout-exercise-stats">
                            {exercise.sets && (
                              <div className="workout-stat">
                                <span className="workout-stat-label">Sets</span>
                                <span className="workout-stat-value">{exercise.sets}</span>
                              </div>
                            )}
                            {exercise.reps && (
                              <div className="workout-stat">
                                <span className="workout-stat-label">Reps</span>
                                <span className="workout-stat-value">{exercise.reps}</span>
                              </div>
                            )}
                            {exercise.rest && (
                              <div className="workout-stat">
                                <span className="workout-stat-label">Rest</span>
                                <span className="workout-stat-value">{exercise.rest}</span>
                              </div>
                            )}
                            {exercise.duration && (
                              <div className="workout-stat">
                                <span className="workout-stat-label">Duration</span>
                                <span className="workout-stat-value">{exercise.duration}</span>
                              </div>
                            )}
                          </div>

                          {exercise.notes && (
                            <p className="workout-exercise-notes">{exercise.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="workout-detail-sidebar">
              <div className="workout-sidebar-card">
                <button
                  className="btn primary workout-download-btn"
                  onClick={() => downloadWorkoutPdf(workout)}
                >
                  &#128196; Download PDF
                </button>
                <p className="workout-download-hint">
                  Get a branded, print-ready PDF of this workout.
                </p>
              </div>

              {/* Equipment */}
              {workout.equipment && workout.equipment.length > 0 && (
                <div className="workout-sidebar-card">
                  <h4>Equipment Needed</h4>
                  <ul className="workout-equipment-list">
                    {workout.equipment.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick stats */}
              <div className="workout-sidebar-card">
                <h4>Quick Stats</h4>
                <div className="workout-quick-stats">
                  <div>
                    <span className="workout-qs-label">Category</span>
                    <span className="workout-qs-value">{workout.category}</span>
                  </div>
                  <div>
                    <span className="workout-qs-label">Difficulty</span>
                    <span className="workout-qs-value">{workout.difficulty}</span>
                  </div>
                  {workout.duration && (
                    <div>
                      <span className="workout-qs-label">Duration</span>
                      <span className="workout-qs-value">{workout.duration}</span>
                    </div>
                  )}
                  <div>
                    <span className="workout-qs-label">Exercises</span>
                    <span className="workout-qs-value">{workout.exercises?.length || 0}</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
