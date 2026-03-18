import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createThread } from '../../api/community';
import { uploadFile } from '../../api/upload';
import './community-new-thread.css';

const CATEGORIES = [
  { id: 'general', label: 'General', icon: '\uD83D\uDCAC' },
  { id: 'workouts', label: 'Workouts', icon: '\u270A' },
  { id: 'exercises', label: 'Exercises', icon: '\uD83C\uDFCB\uFE0F' },
  { id: 'events', label: 'Events', icon: '\uD83D\uDCC5' },
  { id: 'progress', label: 'Progress', icon: '\uD83D\uDCC8' },
  { id: 'tips', label: 'Tips & Mods', icon: '\uD83D\uDCA1' },
];

export default function CommunityNewThread() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = 'Title is required.';
    if (!category) errs.category = 'Please select a category.';
    if (!content.trim()) {
      errs.content = 'Content is required.';
    } else if (content.trim().length < 10) {
      errs.content = 'Content must be at least 10 characters.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    try {
      const token = await getIdToken();
      let imageUrl = null;

      if (image) {
        const uploaded = await uploadFile(image, token);
        imageUrl = uploaded.publicUrl;
      }

      const data = {
        title: title.trim(),
        category,
        content: content.trim(),
        anonymous,
      };
      if (imageUrl) data.imageUrl = imageUrl;

      const result = await createThread(data, token);
      const newId = result.id || result.threadId;
      navigate(`/portal/community/${newId}`);
    } catch (err) {
      console.error('Failed to create thread:', err);
      setErrors({ submit: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="community-new-thread">
      <Link to="/portal/community" className="community-back-link">
        &larr; Back to Community
      </Link>

      <div className="community-new-thread-card">
        <h1>New Thread</h1>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="community-form-group">
            <label htmlFor="thread-title">Title</label>
            <input
              id="thread-title"
              type="text"
              placeholder="Give your thread a title..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
              }}
              maxLength={200}
            />
            {errors.title && (
              <span className="community-form-error">{errors.title}</span>
            )}
          </div>

          {/* Category */}
          <div className="community-form-group">
            <label htmlFor="thread-category">Category</label>
            <select
              id="thread-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (errors.category)
                  setErrors((prev) => ({ ...prev, category: '' }));
              }}
            >
              <option value="">Select a category...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <span className="community-form-error">{errors.category}</span>
            )}
          </div>

          {/* Content */}
          <div className="community-form-group">
            <label htmlFor="thread-content">Content</label>
            <textarea
              id="thread-content"
              placeholder="What's on your mind? (min 10 characters)"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (errors.content)
                  setErrors((prev) => ({ ...prev, content: '' }));
              }}
              rows={6}
            />
            <div className="community-form-hint">
              {content.length} character{content.length !== 1 ? 's' : ''}
              {content.length > 0 && content.length < 10 && (
                <span className="community-form-hint-warn">
                  {' '}({10 - content.length} more needed)
                </span>
              )}
            </div>
            {errors.content && (
              <span className="community-form-error">{errors.content}</span>
            )}
          </div>

          {/* Image Upload */}
          <div className="community-form-group">
            <label>Image (optional)</label>
            {imagePreview ? (
              <div className="community-image-preview">
                <img src={imagePreview} alt="Upload preview" />
                <button
                  type="button"
                  className="community-image-remove"
                  onClick={removeImage}
                >
                  &times; Remove
                </button>
              </div>
            ) : (
              <label className="community-image-upload-area">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  hidden
                />
                <span className="community-image-upload-icon">
                  {'\uD83D\uDDBC\uFE0F'}
                </span>
                <span>Click to upload an image</span>
              </label>
            )}
          </div>

          {/* Anonymous Toggle */}
          <div className="community-form-group">
            <label className="community-anonymous-label">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
              />
              <span>Post anonymously</span>
            </label>
            <p className="community-anonymous-hint">
              Your name and tier badge will be hidden from other members.
            </p>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="community-form-submit-error">{errors.submit}</div>
          )}

          {/* Actions */}
          <div className="community-form-actions">
            <Link to="/portal/community" className="btn ghost">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Thread'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
