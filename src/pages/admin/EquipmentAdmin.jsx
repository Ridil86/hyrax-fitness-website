import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchEquipment,
  createEquipmentApi,
  updateEquipmentApi,
  deleteEquipmentApi,
} from '../../api/equipment';
import { uploadFile } from '../../api/upload';
import LazyImage from '../../components/LazyImage';
import './admin.css';
import './equipment-admin.css';

const EMPTY_EQUIPMENT = {
  name: '',
  description: '',
  notes: '',
  sortOrder: 0,
  imageUrl: '',
};

export default function EquipmentAdmin() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  // Editor state
  const [editing, setEditing] = useState(null); // null = list view, object = editor
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploading, setUploading] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const data = await fetchEquipment(token);
      setItems(data);
    } catch (err) {
      setError(err.message || 'Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleNew = () => {
    setEditing({ ...EMPTY_EQUIPMENT });
    setError(null);
    setSaveMsg('');
  };

  const handleEdit = (item) => {
    setEditing({ ...item });
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
      const payload = { ...editing };

      if (editing.id) {
        await updateEquipmentApi(editing.id, payload, token);
      } else {
        await createEquipmentApi(payload, token);
      }

      setSaveMsg(editing.id ? 'Equipment updated!' : 'Equipment created!');
      setEditing(null);
      await loadItems();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save equipment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = await getIdToken();
      await deleteEquipmentApi(id, token);
      setConfirmDelete(null);
      await loadItems();
    } catch (err) {
      setError(err.message || 'Failed to delete equipment');
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

  // ── List View ──
  if (!editing) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>Equipment Library</h1>
          <p>Create and manage equipment items for the content library</p>
        </div>

        <div className="equipment-admin-toolbar">
          <button className="btn primary" onClick={handleNew}>
            + New Equipment
          </button>
          <span className="equipment-admin-count">
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
          <div className="faq-admin-loading">Loading equipment...</div>
        ) : items.length === 0 ? (
          <div className="admin-placeholder">
            <div className="admin-placeholder-icon">&#9881;</div>
            <h3>No Equipment Yet</h3>
            <p>Create your first equipment item to populate the library.</p>
          </div>
        ) : (
          <div className="equipment-admin-list">
            {items.map((item) => (
              <div key={item.id} className="equipment-admin-card">
                <div className="equipment-admin-card-main">
                  {item.imageUrl && (
                    <LazyImage
                      src={item.imageUrl}
                      alt={item.name}
                      className="equipment-admin-thumb"
                    />
                  )}
                  <div className="equipment-admin-card-info">
                    <h3>{item.name}</h3>
                    {item.description && (
                      <p className="equipment-admin-desc">
                        {item.description.slice(0, 80)}
                        {item.description.length > 80 ? '...' : ''}
                      </p>
                    )}
                    {item.notes && (
                      <p className="equipment-admin-notes">
                        {item.notes.slice(0, 80)}
                        {item.notes.length > 80 ? '...' : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="equipment-admin-actions">
                  <button className="btn ghost small" onClick={() => handleEdit(item)}>
                    Edit
                  </button>
                  {confirmDelete === item.id ? (
                    <div className="equipment-confirm-delete">
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
        <h1>{editing.id ? 'Edit Equipment' : 'New Equipment'}</h1>
        <p>
          {editing.id
            ? `Editing: ${editing.name || 'Untitled'}`
            : 'Create a new equipment item for the library'}
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

      <div className="equipment-editor">
        {/* Basic Information */}
        <div className="equipment-editor-card">
          <h3>Basic Information</h3>

          <div className="content-field">
            <label>Name *</label>
            <input
              value={editing.name}
              onChange={(e) => updateEditing('name', e.target.value)}
              placeholder="e.g., Kettlebell, Resistance Band"
            />
          </div>

          <div className="content-field">
            <label>Description</label>
            <textarea
              value={editing.description}
              onChange={(e) => updateEditing('description', e.target.value)}
              rows={3}
              placeholder="Describe the equipment, its uses, and specifications..."
            />
          </div>

          <div className="content-field">
            <label>Notes</label>
            <textarea
              value={editing.notes}
              onChange={(e) => updateEditing('notes', e.target.value)}
              rows={2}
              placeholder="Internal notes, sourcing info, alternatives..."
            />
          </div>

          <div className="content-field">
            <label>Sort Order</label>
            <input
              type="number"
              value={editing.sortOrder}
              onChange={(e) => updateEditing('sortOrder', parseInt(e.target.value, 10) || 0)}
              placeholder="0"
              style={{ maxWidth: 120 }}
            />
          </div>
        </div>

        {/* Image */}
        <div className="equipment-editor-card">
          <h3>Image</h3>

          <div className="content-field">
            <div className="equipment-image-field">
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
              <div className="equipment-image-preview-wrap">
                <img
                  src={editing.imageUrl}
                  alt="Preview"
                  className="equipment-image-preview"
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
        </div>

        {/* Save Bar */}
        <div className="equipment-editor-actions">
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
              : 'Create Equipment'}
          </button>
        </div>
      </div>
    </div>
  );
}
