import { useState, useEffect, useCallback, useRef } from 'react';
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

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [thumbMinutes, setThumbMinutes] = useState(0);
  const [thumbSeconds, setThumbSeconds] = useState(0);
  const [videoDurationSecs, setVideoDurationSecs] = useState(0);
  const videoPreviewRef = useRef(null);

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

  const captureFrameAtTime = async (targetSeconds) => {
    const videoEl = videoPreviewRef.current;
    if (!videoEl || !editing?.videoUrl) {
      setError('No video loaded to capture from');
      return;
    }

    setGeneratingThumb(true);
    setError(null);

    try {
      // Seek to target time
      videoEl.currentTime = targetSeconds;
      await new Promise((resolve, reject) => {
        const onSeeked = () => { videoEl.removeEventListener('seeked', onSeeked); resolve(); };
        const onError = () => { videoEl.removeEventListener('error', onError); reject(new Error('Video seek failed')); };
        videoEl.addEventListener('seeked', onSeeked);
        videoEl.addEventListener('error', onError);
      });

      // Capture frame to canvas
      const vw = videoEl.videoWidth || 1280;
      const vh = videoEl.videoHeight || 720;
      const maxW = 1280;
      const maxH = 720;
      const scale = Math.min(maxW / vw, maxH / vh, 1);
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, w, h);

      // Convert to blob and upload
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
      const token = await getIdToken();
      const { publicUrl } = await uploadFile(file, token);
      setEditing((prev) => ({ ...prev, thumbnailUrl: publicUrl }));
    } catch (err) {
      setError(`Thumbnail generation failed: ${err.message}`);
    } finally {
      setGeneratingThumb(false);
    }
  };

  const handleAutoGenerateThumb = () => {
    // Capture at 25% of video duration to avoid black intro screens
    const target = videoDurationSecs > 0 ? videoDurationSecs * 0.25 : 1;
    captureFrameAtTime(target);
  };

  const handleCaptureAtTimestamp = () => {
    const target = (thumbMinutes * 60) + thumbSeconds;
    captureFrameAtTime(Math.min(target, videoDurationSecs || target));
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

          {/* Video File (first — duration and thumbnail depend on it) */}
          <div className="content-field">
            <label>Video File</label>
            <span className="video-field-label">Video URL</span>
            <div className="workout-image-field">
              <input
                value={editing.videoUrl}
                onChange={(e) => updateEditing('videoUrl', e.target.value)}
                placeholder="https://..."
              />
              <label className={`content-upload-btn${uploadingVideo ? ' disabled' : ''}`}>
                {uploadingVideo ? 'Uploading...' : 'Upload Video'}
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
            <span className="video-field-helper">Accepted formats: MP4, WebM, MOV. Max recommended resolution: 1080p.</span>
            {uploadingVideo && (
              <div className="video-upload-progress">
                <div className="section-spinner" style={{ width: 20, height: 20 }} />
                <span>Uploading video... This may take a moment for large files.</span>
              </div>
            )}
            {editing.videoUrl && !uploadingVideo && (
              <>
                <div className="video-media-preview">
                  <video
                    ref={videoPreviewRef}
                    src={editing.videoUrl}
                    controls
                    preload="metadata"
                    playsInline
                    crossOrigin="anonymous"
                    onLoadedMetadata={(e) => {
                      const dur = e.target.duration;
                      if (dur && isFinite(dur)) {
                        setVideoDurationSecs(dur);
                        updateEditing('duration', formatDuration(dur));
                      }
                    }}
                  />
                </div>
                {editing.duration && (
                  <div className="video-duration-display">
                    Duration: <strong>{editing.duration}</strong>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Thumbnail */}
          <div className="content-field">
            <label>Thumbnail</label>

            <div className="video-thumb-options">
              {/* Option 1: Auto-generate */}
              <div className="video-thumb-option">
                <button
                  className="btn ghost small"
                  onClick={handleAutoGenerateThumb}
                  disabled={!editing.videoUrl || generatingThumb || uploadingThumb}
                >
                  {generatingThumb ? 'Generating...' : 'Auto-generate Thumbnail'}
                </button>
                <span className="video-thumb-hint">
                  Captures a frame automatically from the video
                </span>
              </div>

              {/* Option 2: Generate at timestamp */}
              <div className="video-thumb-option">
                <div className="video-thumb-timestamp">
                  <label className="video-thumb-ts-label">Capture at:</label>
                  <input
                    type="number"
                    min={0}
                    max={Math.floor(videoDurationSecs / 60)}
                    value={thumbMinutes}
                    onChange={(e) => setThumbMinutes(Math.max(0, Number(e.target.value)))}
                    className="video-thumb-ts-input"
                  />
                  <span>min</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={thumbSeconds}
                    onChange={(e) => setThumbSeconds(Math.max(0, Math.min(59, Number(e.target.value))))}
                    className="video-thumb-ts-input"
                  />
                  <span>sec</span>
                  <button
                    className="btn ghost small"
                    onClick={handleCaptureAtTimestamp}
                    disabled={!editing.videoUrl || generatingThumb || uploadingThumb}
                  >
                    Capture Frame
                  </button>
                </div>
              </div>

              {/* Option 3: Upload manually */}
              <div className="video-thumb-option">
                <span className="video-field-label">Thumbnail URL</span>
                <div className="workout-image-field">
                  <input
                    value={editing.thumbnailUrl}
                    onChange={(e) => updateEditing('thumbnailUrl', e.target.value)}
                    placeholder="https://..."
                  />
                  <label className={`content-upload-btn${uploadingThumb ? ' disabled' : ''}`}>
                    {uploadingThumb ? 'Uploading...' : 'Upload Image'}
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
                <span className="video-thumb-hint">
                  Recommended: JPEG or PNG, 1280&times;720px (16:9 aspect ratio)
                </span>
              </div>
            </div>

            {/* Thumbnail preview (shared across all options) */}
            {editing.thumbnailUrl && (
              <img
                src={editing.thumbnailUrl}
                alt="Thumbnail preview"
                className="video-thumb-preview"
              />
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
