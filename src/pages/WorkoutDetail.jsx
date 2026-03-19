import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { fetchWorkout } from '../api/workouts';
import { fetchExercises } from '../api/exercises';
import { fetchUserLogs } from '../api/completionLog';
import { downloadWorkoutPdf } from '../utils/workoutPdf';
import { hasTierAccess, getRequiredTierInfo } from '../utils/tiers';
import { trackWorkoutView, trackDifficultyChange } from '../utils/analytics';
import CompletionForm from '../components/CompletionForm';
import './workout-detail.css';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'elite'];

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

  // Difficulty adjustment state
  const [activeDifficulty, setActiveDifficulty] = useState(null);
  const [exerciseOverrides, setExerciseOverrides] = useState({});
  const [exerciseData, setExerciseData] = useState({});

  // Completion form state
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [completionCount, setCompletionCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getIdToken();
        const data = await fetchWorkout(id, token);
        if (!cancelled) {
          setWorkout(data);
          setActiveDifficulty(data.difficulty);
          trackWorkoutView(id, data.title, data.difficulty);
        }

        // Load completion count
        fetchUserLogs({ workoutId: id, limit: 500 }, token)
          .then((logs) => {
            if (!cancelled) setCompletionCount(logs.length);
          })
          .catch(() => {});

        // Load full exercise data for referenced exercises
        if (data.exercises?.some((e) => e.exerciseId)) {
          try {
            const allExercises = await fetchExercises(token);
            if (!cancelled) {
              const map = {};
              allExercises.forEach((e) => { map[e.id] = e; });
              setExerciseData(map);
            }
          } catch {
            // Exercise data is best-effort
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load workout');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, getIdToken]);

  // Derive equipment from exercises at current difficulty
  const derivedEquipment = useMemo(() => {
    if (!workout?.exercises) return [];
    const equipMap = new Map();

    workout.exercises.forEach((ex) => {
      if (!ex.exerciseId) return;
      const full = exerciseData[ex.exerciseId];
      if (!full?.modifications) return;
      const diff = exerciseOverrides[ex.exerciseId] || activeDifficulty || workout.difficulty;
      const mod = full.modifications[diff];
      if (mod?.equipment) {
        mod.equipment.forEach((eq) => {
          equipMap.set(eq.equipmentId, eq.equipmentName);
        });
      }
    });

    return Array.from(equipMap.values());
  }, [workout, exerciseData, exerciseOverrides, activeDifficulty]);

  // Check if we have any referenced exercises (vs all legacy)
  const hasReferencedExercises = workout?.exercises?.some((e) => e.exerciseId);

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

  const stars = DIFFICULTY_STARS[activeDifficulty || workout.difficulty] || 2;
  const locked = !isAdmin && !hasTierAccess(userTier, workout.requiredTier);
  const requiredInfo = locked ? getRequiredTierInfo(workout.requiredTier) : null;

  // Show legacy equipment or derived equipment
  const equipmentList = hasReferencedExercises
    ? derivedEquipment
    : (workout.equipment || []);

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
            <span className="workout-detail-badge">{activeDifficulty || workout.difficulty}</span>
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
            {workout.tags?.length > 0 && workout.tags.map((tag, i) => (
              <span key={i} className="workout-detail-badge">{tag}</span>
            ))}
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

              {/* Difficulty Selector */}
              {hasReferencedExercises && (
                <motion.section
                  className="workout-detail-section"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.18 }}
                >
                  <h2>Workout Difficulty</h2>
                  <div className="workout-difficulty-selector">
                    {DIFFICULTIES.map((d) => (
                      <button
                        key={d}
                        className={`workout-difficulty-btn${(activeDifficulty || workout.difficulty) === d ? ' active' : ''}`}
                        onClick={() => {
                          const oldDifficulty = activeDifficulty || workout.difficulty;
                          if (oldDifficulty !== d) {
                            trackDifficultyChange(id, oldDifficulty, d);
                          }
                          setActiveDifficulty(d);
                          setExerciseOverrides({});
                        }}
                      >
                        {d.charAt(0).toUpperCase() + d.slice(1)}
                      </button>
                    ))}
                  </div>
                  <p className="workout-difficulty-hint">
                    Is an exercise too difficult? Adjust the difficulty to see a modification that meets your current fitness level.
                    You can also adjust individual exercises below.
                  </p>
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
                    {workout.exercises.map((exercise, i) => {
                      const isLegacy = !exercise.exerciseId;
                      const full = isLegacy ? null : exerciseData[exercise.exerciseId];
                      const effectiveDiff = isLegacy
                        ? null
                        : exerciseOverrides[exercise.exerciseId] || activeDifficulty || workout.difficulty;
                      const mod = full?.modifications?.[effectiveDiff];
                      const displayName = isLegacy ? exercise.name : exercise.exerciseName;
                      const modImage = mod?.imageUrl || full?.imageUrl;

                      return (
                        <div key={exercise.exerciseId || i} className="workout-exercise-item">
                          <div className="workout-exercise-number">{i + 1}</div>
                          <div className="workout-exercise-content">
                            <div className="workout-exercise-title-row">
                              <h3>{displayName}</h3>
                              {!isLegacy && (
                                <select
                                  className="workout-exercise-diff-select"
                                  value={exerciseOverrides[exercise.exerciseId] || effectiveDiff}
                                  onChange={(e) =>
                                    setExerciseOverrides((prev) => ({
                                      ...prev,
                                      [exercise.exerciseId]: e.target.value,
                                    }))
                                  }
                                >
                                  {DIFFICULTIES.map((d) => (
                                    <option key={d} value={d}>
                                      {d.charAt(0).toUpperCase() + d.slice(1)}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {mod?.subName && (
                              <p className="workout-exercise-mod-name">
                                Modification: {mod.subName}
                              </p>
                            )}

                            {modImage && (
                              <img
                                src={modImage}
                                alt={mod?.subName || displayName}
                                className="workout-exercise-mod-image"
                              />
                            )}

                            {mod?.description && (
                              <p className="workout-exercise-mod-desc">{mod.description}</p>
                            )}

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

                            {(mod?.notes || exercise.notes) && (
                              <p className="workout-exercise-notes">
                                {mod?.notes || exercise.notes}
                              </p>
                            )}

                            {mod?.equipment && mod.equipment.length > 0 && (
                              <div className="workout-exercise-equipment">
                                <span className="workout-exercise-equip-label">Equipment:</span>
                                {mod.equipment.map((eq) => (
                                  <span key={eq.equipmentId} className="workout-exercise-equip-tag">
                                    {eq.equipmentName}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.section>
              )}
            </div>

            {/* Sidebar */}
            <aside className="workout-detail-sidebar">
              <div className="workout-sidebar-card">
                <button
                  className="btn primary workout-download-btn"
                  onClick={() => downloadWorkoutPdf(workout, null, exerciseData)}
                >
                  &#128196; Download PDF
                </button>
                <p className="workout-download-hint">
                  Get a branded, print-ready PDF of this workout.
                </p>
              </div>

              {/* Completion logging */}
              <div className="workout-sidebar-card">
                {showCompletionForm ? (
                  <CompletionForm
                    exercises={(workout.exercises || []).map((ex) => ({
                      exerciseId: ex.exerciseId || '',
                      exerciseName: ex.exerciseName || ex.name,
                      sets: ex.sets,
                      reps: ex.reps,
                      difficulty: activeDifficulty || workout.difficulty,
                    }))}
                    source="workout"
                    sourceId={id}
                    workoutId={id}
                    workoutTitle={workout.title}
                    getIdToken={getIdToken}
                    onComplete={() => {
                      setCompletionCount((c) => (c ?? 0) + 1);
                      setShowCompletionForm(false);
                    }}
                  />
                ) : (
                  <>
                    <button
                      className="btn primary workout-download-btn"
                      onClick={() => setShowCompletionForm(true)}
                    >
                      Log Workout Completion
                    </button>
                    {completionCount !== null && completionCount > 0 && (
                      <p className="workout-download-hint">
                        Completed {completionCount} {completionCount === 1 ? 'time' : 'times'}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Equipment */}
              {equipmentList.length > 0 && (
                <div className="workout-sidebar-card">
                  <h4>Equipment Needed</h4>
                  <ul className="workout-equipment-list">
                    {equipmentList.map((item, i) => (
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
                    <span className="workout-qs-value">{activeDifficulty || workout.difficulty}</span>
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
