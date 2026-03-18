import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchWorkouts,
  createWorkout,
  updateWorkout,
  deleteWorkoutApi,
} from '../../api/workouts';
import { uploadFile } from '../../api/upload';
import { downloadWorkoutPdf } from '../../utils/workoutPdf';
import './admin.css';
import './workout-admin.css';

const CATEGORIES = ['general', 'strength', 'cardio', 'hiit', 'mobility', 'endurance', 'scramble'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'elite'];

const EMPTY_EXERCISE = { name: '', sets: '', reps: '', rest: '', duration: '', notes: '' };

const EMPTY_WORKOUT = {
  title: '',
  description: '',
  category: 'general',
  difficulty: 'intermediate',
  duration: '',
  equipment: [],
  exercises: [{ ...EMPTY_EXERCISE }],
  imageUrl: '',
  status: 'draft',
};

export default function WorkoutAdmin() {
  const { getIdToken } = useAuth();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  // Editor state
  const [editing, setEditing] = useState(null); // null = list view, object = editor
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const data = await fetchWorkouts(token);
      setWorkouts(data);
    } catch (err) {
      setError(err.message || 'Failed to load workouts');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  const handleNew = () => {
    setEditing({ ...EMPTY_WORKOUT, exercises: [{ ...EMPTY_EXERCISE }], equipment: [] });
    setError(null);
    setSaveMsg('');
  };

  const handleEdit = (workout) => {
    setEditing({
      ...workout,
      exercises: workout.exercises?.length ? workout.exercises : [{ ...EMPTY_EXERCISE }],
      equipment: workout.equipment || [],
    });
    setError(null);
    setSaveMsg('');
  };

  const handleCancel = () => {
    setEditing(null);
    setError(null);
    setSaveMsg('');
  };

  const handleSave = async () => {
    if (!editing.title.trim()) {
      setError('Title is required');
      return;
    }

    // Check for exercises with content but no name
    const hasContentNoName = editing.exercises.some(
      (e) =>
        !e.name.trim() &&
        (e.sets || e.reps || e.rest || e.duration || e.notes)
    );
    if (hasContentNoName) {
      setError(
        'All exercises must have a name. Please fill in missing exercise names.'
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMsg('');
    try {
      const token = await getIdToken();
      // Filter out completely empty exercises (no fields filled at all)
      const cleanExercises = editing.exercises.filter(
        (e) => e.name.trim() || e.sets || e.reps || e.rest || e.duration || e.notes
      );
      const payload = { ...editing, exercises: cleanExercises };

      if (editing.id) {
        await updateWorkout(editing.id, payload, token);
      } else {
        await createWorkout(payload, token);
      }

      setSaveMsg(editing.id ? 'Workout updated!' : 'Workout created!');
      setEditing(null);
      await loadWorkouts();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = await getIdToken();
      await deleteWorkoutApi(id, token);
      setConfirmDelete(null);
      await loadWorkouts();
    } catch (err) {
      setError(err.message || 'Failed to delete workout');
    }
  };

  const handleImageUpload = async (file) => {
    setUploading(true);
    try {
      const token = await getIdToken();
      const { publicUrl } = await uploadFile(file, token);
      setEditing((prev) => ({ ...prev, imageUrl: publicUrl }));
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const updateEditing = (field, value) => {
    setEditing((prev) => ({ ...prev, [field]: value }));
  };

  const updateExercise = (index, field, value) => {
    setEditing((prev) => {
      const exercises = [...prev.exercises];
      exercises[index] = { ...exercises[index], [field]: value };
      return { ...prev, exercises };
    });
  };

  const addExercise = () => {
    setEditing((prev) => ({
      ...prev,
      exercises: [...prev.exercises, { ...EMPTY_EXERCISE }],
    }));
  };

  const removeExercise = (index) => {
    setEditing((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== index),
    }));
  };

  const moveExercise = (index, direction) => {
    setEditing((prev) => {
      const exercises = [...prev.exercises];
      const target = index + direction;
      if (target < 0 || target >= exercises.length) return prev;
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...prev, exercises };
    });
  };

  const addEquipment = () => {
    setEditing((prev) => ({
      ...prev,
      equipment: [...prev.equipment, ''],
    }));
  };

  const updateEquipment = (index, value) => {
    setEditing((prev) => {
      const equipment = [...prev.equipment];
      equipment[index] = value;
      return { ...prev, equipment };
    });
  };

  const removeEquipment = (index) => {
    setEditing((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((_, i) => i !== index),
    }));
  };

  // ── List View ──
  if (!editing) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>Workout Library</h1>
          <p>Create and manage workout regimens for the content library</p>
        </div>

        <div className="workout-admin-toolbar">
          <button className="btn primary" onClick={handleNew}>
            + New Workout
          </button>
          <span className="workout-admin-count">
            {workouts.length} workout{workouts.length !== 1 ? 's' : ''}
          </span>
        </div>

        {error && (
          <div className="faq-admin-error" style={{ marginTop: 12 }}>
            {error}
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {saveMsg && <div className="content-save-msg">{saveMsg}</div>}

        {loading ? (
          <div className="faq-admin-loading">Loading workouts...</div>
        ) : workouts.length === 0 ? (
          <div className="admin-placeholder">
            <div className="admin-placeholder-icon">&#128170;</div>
            <h3>No Workouts Yet</h3>
            <p>Create your first workout to populate the content library.</p>
          </div>
        ) : (
          <div className="workout-admin-list">
            {workouts.map((w) => (
              <div key={w.id} className="workout-admin-card">
                <div className="workout-admin-card-main">
                  {w.imageUrl && (
                    <img
                      src={w.imageUrl}
                      alt={w.title}
                      className="workout-admin-thumb"
                    />
                  )}
                  <div className="workout-admin-card-info">
                    <h3>{w.title}</h3>
                    <div className="workout-admin-meta">
                      <span className={`workout-badge ${w.status}`}>
                        {w.status}
                      </span>
                      <span className="workout-badge category">{w.category}</span>
                      <span className="workout-badge difficulty">{w.difficulty}</span>
                      {w.duration && <span className="workout-badge">{w.duration}</span>}
                    </div>
                    <p className="workout-admin-desc">
                      {w.description?.slice(0, 120)}
                      {w.description?.length > 120 ? '...' : ''}
                    </p>
                    <span className="workout-admin-exercises">
                      {w.exercises?.length || 0} exercise{(w.exercises?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="workout-admin-actions">
                  <button className="btn ghost small" onClick={() => handleEdit(w)}>
                    Edit
                  </button>
                  <button
                    className="btn ghost small"
                    onClick={() => downloadWorkoutPdf(w)}
                    title="Preview PDF"
                  >
                    PDF
                  </button>
                  {confirmDelete === w.id ? (
                    <div className="workout-confirm-delete">
                      <span>Delete?</span>
                      <button
                        className="btn ghost small danger"
                        onClick={() => handleDelete(w.id)}
                      >
                        Yes
                      </button>
                      <button
                        className="btn ghost small"
                        onClick={() => setConfirmDelete(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn ghost small danger"
                      onClick={() => setConfirmDelete(w.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Editor View ──
  return (
    <div>
      <div className="admin-page-header">
        <h1>{editing.id ? 'Edit Workout' : 'New Workout'}</h1>
        <p>
          {editing.id
            ? `Editing: ${editing.title || 'Untitled'}`
            : 'Create a new workout for the content library'}
        </p>
      </div>

      {error && (
        <div className="faq-admin-error" style={{ marginTop: 12 }}>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="workout-editor">
        {/* Basic Info */}
        <div className="workout-editor-card">
          <h3>Basic Information</h3>

          <div className="content-field">
            <label>Title *</label>
            <input
              value={editing.title}
              onChange={(e) => updateEditing('title', e.target.value)}
              placeholder="e.g., Outcrop Circuit - Full Body Blast"
            />
          </div>

          <div className="content-field">
            <label>Description</label>
            <textarea
              value={editing.description}
              onChange={(e) => updateEditing('description', e.target.value)}
              rows={3}
              placeholder="Describe the workout, its goals, and who it's for..."
            />
          </div>

          <div className="workout-editor-row">
            <div className="content-field">
              <label>Category</label>
              <select
                value={editing.category}
                onChange={(e) => updateEditing('category', e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="content-field">
              <label>Difficulty</label>
              <select
                value={editing.difficulty}
                onChange={(e) => updateEditing('difficulty', e.target.value)}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="content-field">
              <label>Duration</label>
              <input
                value={editing.duration}
                onChange={(e) => updateEditing('duration', e.target.value)}
                placeholder="e.g., 45 min"
              />
            </div>

            <div className="content-field">
              <label>Status</label>
              <select
                value={editing.status}
                onChange={(e) => updateEditing('status', e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          <div className="content-field">
            <label>Cover Image</label>
            <div className="workout-image-field">
              <input
                value={editing.imageUrl}
                onChange={(e) => updateEditing('imageUrl', e.target.value)}
                placeholder="Image URL"
              />
              <label className={`content-upload-btn${uploading ? ' disabled' : ''}`}>
                {uploading ? 'Uploading...' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  hidden
                />
              </label>
            </div>
            {editing.imageUrl && (
              <img
                src={editing.imageUrl}
                alt="Preview"
                className="workout-image-preview"
              />
            )}
          </div>
        </div>

        {/* Equipment */}
        <div className="workout-editor-card">
          <h3>Equipment</h3>
          {editing.equipment.map((item, i) => (
            <div key={i} className="content-inline-group">
              <input
                value={item}
                onChange={(e) => updateEquipment(i, e.target.value)}
                placeholder="e.g., Kettlebell (24kg)"
              />
              <button
                className="content-remove-btn"
                onClick={() => removeEquipment(i)}
              >
                x
              </button>
            </div>
          ))}
          <button className="btn ghost content-add-btn" onClick={addEquipment}>
            + Add Equipment
          </button>
        </div>

        {/* Exercises */}
        <div className="workout-editor-card">
          <h3>
            Exercises ({editing.exercises.length})
          </h3>

          {editing.exercises.map((exercise, i) => (
            <div key={i} className="workout-exercise-card">
              <div className="workout-exercise-header">
                <span className="workout-exercise-num">{i + 1}</span>
                <input
                  className={`workout-exercise-name${
                    !exercise.name.trim() &&
                    (exercise.sets || exercise.reps || exercise.rest || exercise.duration || exercise.notes)
                      ? ' invalid'
                      : ''
                  }`}
                  value={exercise.name}
                  onChange={(e) => updateExercise(i, 'name', e.target.value)}
                  placeholder="Exercise name *"
                />
                <div className="workout-exercise-controls">
                  <button
                    className="workout-move-btn"
                    onClick={() => moveExercise(i, -1)}
                    disabled={i === 0}
                    title="Move up"
                  >
                    &#9650;
                  </button>
                  <button
                    className="workout-move-btn"
                    onClick={() => moveExercise(i, 1)}
                    disabled={i === editing.exercises.length - 1}
                    title="Move down"
                  >
                    &#9660;
                  </button>
                  <button
                    className="content-remove-btn"
                    onClick={() => removeExercise(i)}
                  >
                    x
                  </button>
                </div>
              </div>

              <div className="workout-exercise-details">
                <div className="content-field">
                  <label>Sets</label>
                  <input
                    value={exercise.sets}
                    onChange={(e) => updateExercise(i, 'sets', e.target.value)}
                    placeholder="e.g., 4"
                  />
                </div>
                <div className="content-field">
                  <label>Reps</label>
                  <input
                    value={exercise.reps}
                    onChange={(e) => updateExercise(i, 'reps', e.target.value)}
                    placeholder="e.g., 12"
                  />
                </div>
                <div className="content-field">
                  <label>Rest</label>
                  <input
                    value={exercise.rest}
                    onChange={(e) => updateExercise(i, 'rest', e.target.value)}
                    placeholder="e.g., 60s"
                  />
                </div>
                <div className="content-field">
                  <label>Duration</label>
                  <input
                    value={exercise.duration}
                    onChange={(e) => updateExercise(i, 'duration', e.target.value)}
                    placeholder="e.g., 30s"
                  />
                </div>
              </div>

              <div className="content-field">
                <label>Notes</label>
                <textarea
                  value={exercise.notes}
                  onChange={(e) => updateExercise(i, 'notes', e.target.value)}
                  rows={2}
                  placeholder="Form cues, variations, scaling options..."
                />
              </div>
            </div>
          ))}

          <button className="btn ghost content-add-btn" onClick={addExercise}>
            + Add Exercise
          </button>
        </div>

        {/* Save Bar */}
        <div className="workout-editor-actions">
          <button className="btn ghost" onClick={handleCancel}>
            Cancel
          </button>
          <button
            className="btn ghost"
            onClick={() => downloadWorkoutPdf(editing)}
          >
            Preview PDF
          </button>
          <button
            className="btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : editing.id
              ? 'Save Changes'
              : 'Create Workout'}
          </button>
        </div>
      </div>
    </div>
  );
}
