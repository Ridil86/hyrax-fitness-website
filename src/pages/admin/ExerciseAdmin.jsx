import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchExercises,
  createExerciseApi,
  updateExerciseApi,
  deleteExerciseApi,
} from '../../api/exercises';
import { uploadFile } from '../../api/upload';
import { useEquipment } from '../../hooks/useEquipment';
import LazyImage from '../../components/LazyImage';
import './exercise-admin.css';

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'elite'];

const EMPTY_MODIFICATION = { subName: '', description: '', imageUrl: '', notes: '', equipment: [] };

const EMPTY_EXERCISE = {
  name: '', description: '', imageUrl: '', notes: '', sortOrder: 999, tags: [],
  modifications: {
    beginner: { ...EMPTY_MODIFICATION },
    intermediate: { ...EMPTY_MODIFICATION },
    advanced: { ...EMPTY_MODIFICATION },
    elite: { ...EMPTY_MODIFICATION },
  },
};

function mergeModifications(existing) {
  const merged = {};
  for (const d of DIFFICULTIES) {
    merged[d] = {
      ...EMPTY_MODIFICATION,
      ...(existing?.[d] || {}),
      equipment: existing?.[d]?.equipment ? [...existing[d].equipment] : [],
    };
  }
  return merged;
}

function countFilledModifications(modifications) {
  if (!modifications) return 0;
  return DIFFICULTIES.filter((d) => modifications[d]?.subName?.trim()).length;
}

export default function ExerciseAdmin() {
  const { getIdToken } = useAuth();
  const { equipment: allEquipment } = useEquipment(getIdToken);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  // Editor state
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingMod, setUploadingMod] = useState(null);

  // Collapsible panels
  const [expandedPanels, setExpandedPanels] = useState({});

  // Equipment search per panel
  const [equipSearch, setEquipSearch] = useState({});

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const data = await fetchExercises(token);
      setItems(data);
    } catch (err) {
      setError(err.message || 'Failed to load exercises');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleNew = () => {
    setEditing({
      ...EMPTY_EXERCISE,
      modifications: mergeModifications(null),
    });
    setExpandedPanels({});
    setEquipSearch({});
    setError(null);
    setSaveMsg('');
  };

  const handleEdit = (item) => {
    setEditing({
      ...item,
      tags: item.tags || [],
      modifications: mergeModifications(item.modifications),
    });
    setExpandedPanels({});
    setEquipSearch({});
    setError(null);
    setSaveMsg('');
  };

  const handleCancel = () => {
    setEditing(null);
    setError(null);
    setSaveMsg('');
  };

  const handleSave = async () => {
    if (!editing.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSaveMsg('');
    try {
      const token = await getIdToken();
      const cleanTags = editing.tags.filter((t) => t.trim());
      const payload = { ...editing, tags: cleanTags };

      if (editing.id) {
        await updateExerciseApi(editing.id, payload, token);
      } else {
        await createExerciseApi(payload, token);
      }

      setSaveMsg(editing.id ? 'Exercise updated!' : 'Exercise created!');
      setEditing(null);
      await loadItems();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save exercise');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = await getIdToken();
      await deleteExerciseApi(id, token);
      setConfirmDelete(null);
      await loadItems();
    } catch (err) {
      setError(err.message || 'Failed to delete exercise');
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

  const handleModImageUpload = async (file, difficulty) => {
    setUploadingMod(difficulty);
    try {
      const token = await getIdToken();
      const { publicUrl } = await uploadFile(file, token);
      setEditing((prev) => ({
        ...prev,
        modifications: {
          ...prev.modifications,
          [difficulty]: { ...prev.modifications[difficulty], imageUrl: publicUrl },
        },
      }));
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setUploadingMod(null);
    }
  };

  const updateEditing = (field, value) => {
    setEditing((prev) => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    setEditing((prev) => ({ ...prev, tags: [...prev.tags, ''] }));
  };

  const updateTag = (index, value) => {
    setEditing((prev) => {
      const tags = [...prev.tags];
      tags[index] = value;
      return { ...prev, tags };
    });
  };

  const removeTag = (index) => {
    setEditing((prev) => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const updateModification = (difficulty, field, value) => {
    setEditing((prev) => ({
      ...prev,
      modifications: {
        ...prev.modifications,
        [difficulty]: { ...prev.modifications[difficulty], [field]: value },
      },
    }));
  };

  const togglePanel = (difficulty) => {
    setExpandedPanels((prev) => ({ ...prev, [difficulty]: !prev[difficulty] }));
  };

  const toggleEquipment = (difficulty, eq) => {
    setEditing((prev) => {
      const mod = prev.modifications[difficulty];
      const existing = mod.equipment || [];
      const found = existing.some((e) => e.equipmentId === eq.id);
      const updated = found
        ? existing.filter((e) => e.equipmentId !== eq.id)
        : [...existing, { equipmentId: eq.id, equipmentName: eq.name }];
      return {
        ...prev,
        modifications: {
          ...prev.modifications,
          [difficulty]: { ...mod, equipment: updated },
        },
      };
    });
  };

  const removeEquipmentTag = (difficulty, equipmentId) => {
    setEditing((prev) => {
      const mod = prev.modifications[difficulty];
      return {
        ...prev,
        modifications: {
          ...prev.modifications,
          [difficulty]: {
            ...mod,
            equipment: (mod.equipment || []).filter((e) => e.equipmentId !== equipmentId),
          },
        },
      };
    });
  };

  // ── List View ──
  if (!editing) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>Exercise Library</h1>
          <p>Create and manage exercises with difficulty modifications</p>
        </div>

        <div className="exercise-admin-toolbar">
          <button className="btn primary" onClick={handleNew}>
            + New Exercise
          </button>
          <span className="exercise-admin-count">
            {items.length} item{items.length !== 1 ? 's' : ''}
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
          <div className="faq-admin-loading">Loading exercises...</div>
        ) : items.length === 0 ? (
          <div className="admin-placeholder">
            <div className="admin-placeholder-icon">&#9917;</div>
            <h3>No Exercises Yet</h3>
            <p>Create your first exercise to populate the library.</p>
          </div>
        ) : (
          <div className="exercise-admin-list">
            {items.map((item) => (
              <div key={item.id} className="exercise-admin-card">
                <div className="exercise-admin-card-main">
                  {item.imageUrl && (
                    <LazyImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="exercise-admin-thumb"
                    />
                  )}
                  <div className="exercise-admin-card-info">
                    <h3>{item.name}</h3>
                    {item.description && (
                      <p className="exercise-admin-desc">
                        {item.description.slice(0, 80)}
                        {item.description.length > 80 ? '...' : ''}
                      </p>
                    )}
                    <div className="exercise-admin-meta">
                      <span className="exercise-admin-mod-count">
                        {countFilledModifications(item.modifications)}/4 modifications
                      </span>
                      {item.tags?.length > 0 && (
                        <span className="exercise-admin-tags">
                          {item.tags.length} tag{item.tags.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {item.sortOrder !== undefined && (
                        <span className="exercise-admin-sort">
                          Sort: {item.sortOrder}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="exercise-admin-actions">
                  <button className="btn ghost small" onClick={() => handleEdit(item)}>
                    Edit
                  </button>
                  {confirmDelete === item.id ? (
                    <div className="exercise-confirm-delete">
                      <span>Delete?</span>
                      <button
                        className="btn ghost small danger"
                        onClick={() => handleDelete(item.id)}
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
                      onClick={() => setConfirmDelete(item.id)}
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
        <h1>{editing.id ? 'Edit Exercise' : 'New Exercise'}</h1>
        <p>
          {editing.id
            ? `Editing: ${editing.name || 'Untitled'}`
            : 'Create a new exercise for the library'}
        </p>
      </div>

      <button className="btn ghost" onClick={handleCancel} style={{ marginBottom: 16 }}>
        &larr; Back to List
      </button>

      {error && (
        <div className="faq-admin-error" style={{ marginTop: 12 }}>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="exercise-admin-editor">
        {/* Section 1 - Basic Information */}
        <div className="exercise-admin-editor-card">
          <h3>Basic Information</h3>

          <div className="content-field">
            <label>Name *</label>
            <input
              value={editing.name}
              onChange={(e) => updateEditing('name', e.target.value)}
              placeholder="e.g., Pull-up, Squat, Deadlift"
            />
          </div>

          <div className="content-field">
            <label>Description</label>
            <textarea
              value={editing.description}
              onChange={(e) => updateEditing('description', e.target.value)}
              rows={3}
              placeholder="Describe the exercise, its purpose, and muscle groups targeted..."
            />
          </div>

          <div className="content-field">
            <label>Image</label>
            <div className="exercise-admin-image-field">
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
              <div className="exercise-admin-image-preview-wrap">
                <img
                  src={editing.imageUrl}
                  alt="Preview"
                  className="exercise-admin-image-preview"
                />
                <button
                  className="btn ghost small danger"
                  onClick={() => updateEditing('imageUrl', '')}
                >
                  Remove Image
                </button>
              </div>
            )}
          </div>

          <div className="content-field">
            <label>Notes</label>
            <textarea
              value={editing.notes}
              onChange={(e) => updateEditing('notes', e.target.value)}
              rows={2}
              placeholder="Internal notes, coaching cues, common mistakes..."
            />
          </div>

          <div className="content-field">
            <label>Sort Order</label>
            <input
              type="number"
              value={editing.sortOrder}
              onChange={(e) => updateEditing('sortOrder', parseInt(e.target.value, 10) || 0)}
              placeholder="999"
              style={{ maxWidth: 120 }}
            />
          </div>
        </div>

        {/* Tags */}
        <div className="exercise-admin-editor-card">
          <h3>Tags</h3>
          {editing.tags.map((tag, i) => (
            <div key={i} className="content-inline-group">
              <input
                value={tag}
                onChange={(e) => updateTag(i, e.target.value)}
                placeholder="e.g., Indoor, Outdoor, Home, Gym"
              />
              <button className="content-remove-btn" onClick={() => removeTag(i)}>x</button>
            </div>
          ))}
          <button className="btn ghost content-add-btn" onClick={addTag}>+ Add Tag</button>
        </div>

        {/* Section 2 - Modifications */}
        <div className="exercise-admin-editor-card">
          <h3>Modifications</h3>

          {DIFFICULTIES.map((difficulty) => {
            const mod = editing.modifications[difficulty];
            const isFilled = mod.subName?.trim();
            const isExpanded = expandedPanels[difficulty];
            const search = equipSearch[difficulty] || '';
            const filteredEquipment = allEquipment.filter((eq) =>
              eq.name.toLowerCase().includes(search.toLowerCase())
            );
            const isUploadingThis = uploadingMod === difficulty;

            return (
              <div key={difficulty} className="exercise-admin-mod-panel">
                <button
                  className="exercise-admin-mod-header"
                  onClick={() => togglePanel(difficulty)}
                  type="button"
                >
                  <div className="exercise-admin-mod-header-left">
                    <span
                      className={`exercise-admin-mod-dot ${isFilled ? 'filled' : 'empty'}`}
                    />
                    <span className="exercise-admin-mod-title">
                      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                    </span>
                    {isFilled && (
                      <span className="exercise-admin-mod-sub">{mod.subName}</span>
                    )}
                  </div>
                  <span className={`exercise-admin-mod-chevron ${isExpanded ? 'open' : ''}`}>
                    &#9660;
                  </span>
                </button>

                <div
                  className={`exercise-admin-mod-body ${isExpanded ? 'expanded' : ''}`}
                >
                  <div className="exercise-admin-mod-body-inner">
                    <div className="content-field">
                      <label>Variant Name</label>
                      <input
                        value={mod.subName}
                        onChange={(e) => updateModification(difficulty, 'subName', e.target.value)}
                        placeholder="e.g., Assisted Pull-up, Weighted Pull-up"
                      />
                    </div>

                    <div className="content-field">
                      <label>Description</label>
                      <textarea
                        value={mod.description}
                        onChange={(e) => updateModification(difficulty, 'description', e.target.value)}
                        rows={2}
                        placeholder="Describe this modification..."
                      />
                    </div>

                    <div className="content-field">
                      <label>Image</label>
                      <div className="exercise-admin-image-field">
                        <input
                          value={mod.imageUrl}
                          onChange={(e) => updateModification(difficulty, 'imageUrl', e.target.value)}
                          placeholder="Image URL"
                        />
                        <label className={`content-upload-btn${isUploadingThis ? ' disabled' : ''}`}>
                          {isUploadingThis ? 'Uploading...' : 'Upload'}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={isUploadingThis}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleModImageUpload(file, difficulty);
                            }}
                            hidden
                          />
                        </label>
                      </div>
                      {mod.imageUrl && (
                        <div className="exercise-admin-image-preview-wrap">
                          <img
                            src={mod.imageUrl}
                            alt="Preview"
                            className="exercise-admin-image-preview"
                          />
                          <button
                            className="btn ghost small danger"
                            onClick={() => updateModification(difficulty, 'imageUrl', '')}
                          >
                            Remove Image
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="content-field">
                      <label>Notes</label>
                      <textarea
                        value={mod.notes}
                        onChange={(e) => updateModification(difficulty, 'notes', e.target.value)}
                        rows={2}
                        placeholder="Coaching cues, scaling notes..."
                      />
                    </div>

                    {/* Equipment multi-select */}
                    <div className="content-field">
                      <label>Equipment</label>

                      {mod.equipment && mod.equipment.length > 0 && (
                        <div className="exercise-admin-equip-tags">
                          {mod.equipment.map((eq) => (
                            <span key={eq.equipmentId} className="exercise-admin-equip-tag">
                              {eq.equipmentName}
                              <button
                                type="button"
                                className="exercise-admin-equip-tag-remove"
                                onClick={() => removeEquipmentTag(difficulty, eq.equipmentId)}
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <input
                        className="exercise-admin-equip-search"
                        value={search}
                        onChange={(e) =>
                          setEquipSearch((prev) => ({ ...prev, [difficulty]: e.target.value }))
                        }
                        placeholder="Search equipment..."
                      />

                      <div className="exercise-admin-equip-list">
                        {filteredEquipment.map((eq) => {
                          const isChecked = (mod.equipment || []).some(
                            (e) => e.equipmentId === eq.id
                          );
                          return (
                            <label key={eq.id} className="exercise-admin-equip-item">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleEquipment(difficulty, eq)}
                              />
                              <span>{eq.name}</span>
                            </label>
                          );
                        })}
                        {filteredEquipment.length === 0 && (
                          <p className="exercise-admin-equip-empty">No equipment found</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Save Bar */}
        <div className="exercise-admin-editor-actions">
          <button className="btn ghost" onClick={handleCancel}>
            Cancel
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
              : 'Create Exercise'}
          </button>
        </div>
      </div>
    </div>
  );
}
