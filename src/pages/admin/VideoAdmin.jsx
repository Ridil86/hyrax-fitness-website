import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchVideos,
  createVideo,
  updateVideo,
  deleteVideoApi,
} from '../../api/videos';
import { uploadFile } from '../../api/upload';
import './admin.css';
import './video-admin.css';

const CATEGORIES = [
  { value: 'program-explainer', label: 'Program Explainer' },
  { value: 'movement-tutorial', label: 'Movement Tutorial' },
  { value: 'full-workout-routine', label: 'Full Workout Routine' },
];

const TIER_OPTIONS = [
  { value: 'Pup', label: 'Pup (Free)' },
  { value: 'Rock Runner', label: 'Rock Runner ($5/mo)' },
  { value: 'Iron Dassie', label: 'Iron Dassie ($20/mo)' },
];

const EMPTY_VIDEO = {
  title: '',
  description: '',
  category: 'program-explainer',
  thumbnailUrl: '',
  videoUrl: '',
  requiredTier: 'Pup',
  duration: '',
  status: 'draft',
  sortOrder: 999,
  tags: [],
};

export default function VideoAdmin() {
  const { getIdToken } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  // Editor state
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const data = await fetchVideos(token);
      setVideos(data);
    } catch (err) {
      setError(err.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleNew = () => {
    setEditing({ ...EMPTY_VIDEO, tags: [] });
    setError(null);
    setSaveMsg('');
  };

  const handleEdit = (video) => {
    setEditing({
      ...video,
      tags: video.tags || [],
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

    setSaving(true);
    setError(null);
    setSaveMsg('');
    try {
      const token = await getIdToken();
      // Filter out empty tags
      const cleanTags = editing.tags.filter((t) => t.trim());
      const payload = { ...editing, tags: cleanTags };

      if (editing.id) {
        await updateVideo(editing.id, payload, token);
      } else {
        await createVideo(payload, token);
      }

      setSaveMsg(editing.id ? 'Video updated!' : 'Video created!');
      setEditing(null);
      await loadVideos();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save video');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = await getIdToken();
      await deleteVideoApi(id, token);
      setConfirmDelete(null);
      await loadVideos();
    } catch (err) {
      setError(err.message || 'Failed to delete video');
    }
  };

  const handleThumbUpload = async (file) => {
    setUploadingThumb(true);
    try {
      const token = await getIdToken();
      const { publicUrl } = await uploadFile(file, token);
      setEditing((prev) => ({ ...prev, thumbnailUrl: publicUrl }));
    } catch (err) {
      setError(`Thumbnail upload failed: ${err.message}`);
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleVideoUpload = async (file) => {
    setUploadingVideo(true);
    try {
      const token = await getIdToken();
      const { publicUrl } = await uploadFile(file, token);
      setEditing((prev) => ({ ...prev, videoUrl: publicUrl }));
    } catch (err) {
      setError(`Video upload failed: ${err.message}`);
    } finally {
      setUploadingVideo(false);
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

  // Filtered list
  const filteredVideos = videos.filter((v) => {
    if (filterCategory !== 'all' && v.category !== filterCategory) return false;
    if (filterStatus !== 'all' && v.status !== filterStatus) return false;
    return true;
  });

  const getCategoryLabel = (value) => {
    const cat = CATEGORIES.find((c) => c.value === value);
    return cat ? cat.label : value;
  };

  // ── List View ──
  if (!editing) {
    return (
      <div>
        <div className="admin-page-header">
          <h1>Video Library</h1>
          <p>Upload and manage videos for the content library</p>
        </div>

        <div className="video-admin-toolbar">
          <button className="btn primary" onClick={handleNew}>
            + New Video
          </button>
          <span className="video-admin-count">
            {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="video-admin-filter-bar">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        {error && (
          <div className="faq-admin-error" style={{ marginTop: 12 }}>
            {error}
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}

        {saveMsg && <div className="content-save-msg">{saveMsg}</div>}

        {loading ? (
          <div className="faq-admin-loading">Loading videos...</div>
        ) : filteredVideos.length === 0 ? (
          <div className="admin-placeholder">
            <div className="admin-placeholder-icon">&#9654;</div>
            <h3>No Videos Yet</h3>
            <p>Upload your first video to build the content library.</p>
          </div>
        ) : (
          <div className="video-admin-list">
            {filteredVideos.map((v) => (
              <div key={v.id} className="video-admin-card">
                <div className="video-admin-card-main">
                  {v.thumbnailUrl ? (
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="video-admin-thumb"
                    />
                  ) : (
                    <div className="video-admin-thumb-placeholder">&#9654;</div>
                  )}
                  <div className="video-admin-card-info">
                    <h3>{v.title}</h3>
                    <div className="video-admin-meta">
                      <span className={`workout-badge ${v.status}`}>
                        {v.status}
                      </span>
                      <span className="workout-badge category">
                        {getCategoryLabel(v.category)}
                      </span>
                      {v.duration && <span className="workout-badge">{v.duration}</span>}
                      {v.requiredTier && v.requiredTier !== 'Pup' && (
                        <span className="workout-badge tier">{v.requiredTier}</span>
                      )}
                      {v.transcodingStatus === 'processing' && (
                        <span className="workout-badge transcoding">Transcoding...</span>
                      )}
                      {v.transcodingStatus === 'complete' && (
                        <span className="workout-badge transcoded">HLS Ready</span>
                      )}
                      {v.transcodingStatus === 'error' && (
                        <span className="workout-badge transcode-error">Transcode Failed</span>
                      )}
                    </div>
                    <p className="video-admin-desc">
                      {v.description?.slice(0, 120)}
                      {v.description?.length > 120 ? '...' : ''}
                    </p>
                    {v.tags?.length > 0 && (
                      <span className="video-admin-tags">
                        {v.tags.length} tag{v.tags.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="video-admin-actions">
                  <button className="btn ghost small" onClick={() => handleEdit(v)}>
                    Edit
                  </button>
                  {confirmDelete === v.id ? (
                    <div className="workout-confirm-delete">
                      <span>Delete?</span>
                      <button
                        className="btn ghost small danger"
                        onClick={() => handleDelete(v.id)}
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
                      onClick={() => setConfirmDelete(v.id)}
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
        <h1>{editing.id ? 'Edit Video' : 'New Video'}</h1>
        <p>
          {editing.id
            ? `Editing: ${editing.title || 'Untitled'}`
            : 'Upload a new video to the content library'}
        </p>
      </div>

      {error && (
        <div className="faq-admin-error" style={{ marginTop: 12 }}>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="video-editor">
        {/* Basic Info */}
        <div className="workout-editor-card">
          <h3>Basic Information</h3>

          <div className="content-field">
            <label>Title *</label>
            <input
              value={editing.title}
              onChange={(e) => updateEditing('title', e.target.value)}
              placeholder="e.g., Intro to Hyrax Fitness"
            />
          </div>

          <div className="content-field">
            <label>Description</label>
            <textarea
              value={editing.description}
              onChange={(e) => updateEditing('description', e.target.value)}
              rows={3}
              placeholder="Describe the video content and what viewers will learn..."
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
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="content-field">
              <label>Duration</label>
              <input
                value={editing.duration}
                onChange={(e) => updateEditing('duration', e.target.value)}
                placeholder="e.g., 12:34"
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

            <div className="content-field">
              <label>Required Tier</label>
              <select
                value={editing.requiredTier || 'Pup'}
                onChange={(e) => updateEditing('requiredTier', e.target.value)}
              >
                {TIER_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="content-field">
              <label>Sort Order</label>
              <input
                type="number"
                value={editing.sortOrder}
                onChange={(e) => updateEditing('sortOrder', Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Media */}
        <div className="workout-editor-card">
          <h3>Media</h3>

          <div className="content-field">
            <label>Thumbnail Image</label>
            <div className="workout-image-field">
              <input
                value={editing.thumbnailUrl}
                onChange={(e) => updateEditing('thumbnailUrl', e.target.value)}
                placeholder="Thumbnail URL"
              />
              <label className={`content-upload-btn${uploadingThumb ? ' disabled' : ''}`}>
                {uploadingThumb ? 'Uploading...' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingThumb}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleThumbUpload(file);
                  }}
                  hidden
                />
              </label>
            </div>
            {editing.thumbnailUrl && (
              <img
                src={editing.thumbnailUrl}
                alt="Thumbnail preview"
                className="workout-image-preview"
              />
            )}
          </div>

          <div className="content-field">
            <label>Video File</label>
            <div className="workout-image-field">
              <input
                value={editing.videoUrl}
                onChange={(e) => updateEditing('videoUrl', e.target.value)}
                placeholder="Video URL"
              />
              <label className={`content-upload-btn${uploadingVideo ? ' disabled' : ''}`}>
                {uploadingVideo ? 'Uploading...' : 'Upload'}
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  disabled={uploadingVideo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoUpload(file);
                  }}
                  hidden
                />
              </label>
            </div>
            {uploadingVideo && (
              <div className="video-upload-progress">
                <div className="section-spinner" style={{ width: 20, height: 20 }} />
                <span>Uploading video... This may take a moment for large files.</span>
              </div>
            )}
            {editing.videoUrl && !uploadingVideo && (
              <div className="video-media-preview">
                <video
                  src={editing.videoUrl}
                  controls
                  preload="metadata"
                  playsInline
                />
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="workout-editor-card">
          <h3>Tags ({editing.tags.length})</h3>
          {editing.tags.map((tag, i) => (
            <div key={i} className="content-inline-group">
              <input
                value={tag}
                onChange={(e) => updateTag(i, e.target.value)}
                placeholder="e.g., warm-up, beginner, upper-body"
              />
              <button
                className="content-remove-btn"
                onClick={() => removeTag(i)}
              >
                x
              </button>
            </div>
          ))}
          <button className="btn ghost content-add-btn" onClick={addTag}>
            + Add Tag
          </button>
        </div>

        {/* Save Bar */}
        <div className="workout-editor-actions">
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
              : 'Create Video'}
          </button>
        </div>
      </div>
    </div>
  );
}
