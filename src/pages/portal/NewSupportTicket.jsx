import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createTicket } from '../../api/support';
import { uploadFile } from '../../api/upload';
import './new-support-ticket.css';

const CATEGORIES = [
  { id: 'account', label: 'Account' },
  { id: 'billing', label: 'Billing' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'videos', label: 'Videos' },
  { id: 'technical', label: 'Technical' },
  { id: 'general', label: 'General' },
];

export default function NewSupportTicket() {
  const navigate = useNavigate();
  const { getIdToken } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = 'Title is required.';
    if (!category) errs.category = 'Please select a category.';
    if (!description.trim()) {
      errs.description = 'Description is required.';
    } else if (description.trim().length < 20) {
      errs.description = 'Description must be at least 20 characters.';
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
      let attachmentUrl = null;

      if (image) {
        const uploaded = await uploadFile(image, token);
        attachmentUrl = uploaded.publicUrl;
      }

      const data = {
        title: title.trim(),
        category,
        description: description.trim(),
      };
      if (attachmentUrl) data.attachmentUrl = attachmentUrl;

      const result = await createTicket(data, token);
      const newId = result.id || result.ticketId;
      navigate(`/portal/support/${newId}`);
    } catch (err) {
      console.error('Failed to create ticket:', err);
      setErrors({ submit: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="new-support-ticket">
      <Link to="/portal/support" className="support-back-link">
        &larr; Back to Support
      </Link>

      <div className="new-support-ticket-card">
        <h1>Submit a Support Request</h1>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="support-form-group">
            <label htmlFor="ticket-title">Title</label>
            <input
              id="ticket-title"
              type="text"
              placeholder="Brief summary of your issue..."
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
              }}
              maxLength={200}
            />
            {errors.title && (
              <span className="support-form-error">{errors.title}</span>
            )}
          </div>

          {/* Category */}
          <div className="support-form-group">
            <label htmlFor="ticket-category">Category</label>
            <select
              id="ticket-category"
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
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <span className="support-form-error">{errors.category}</span>
            )}
          </div>

          {/* Description */}
          <div className="support-form-group">
            <label htmlFor="ticket-description">Description</label>
            <textarea
              id="ticket-description"
              placeholder="Describe your issue in detail (min 20 characters)..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description)
                  setErrors((prev) => ({ ...prev, description: '' }));
              }}
              rows={6}
            />
            <div className="support-form-hint">
              {description.length} character{description.length !== 1 ? 's' : ''}
              {description.length > 0 && description.length < 20 && (
                <span className="support-form-hint-warn">
                  {' '}({20 - description.length} more needed)
                </span>
              )}
            </div>
            {errors.description && (
              <span className="support-form-error">{errors.description}</span>
            )}
          </div>

          {/* Attachment */}
          <div className="support-form-group">
            <label>Attachment (optional)</label>
            {imagePreview ? (
              <div className="support-image-preview">
                <img src={imagePreview} alt="Upload preview" />
                <button
                  type="button"
                  className="support-image-remove"
                  onClick={removeImage}
                >
                  &times; Remove
                </button>
              </div>
            ) : (
              <label className="support-image-upload-area">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  hidden
                />
                <span className="support-image-upload-icon">
                  {'\uD83D\uDCC1'}
                </span>
                <span>Click to attach a file or screenshot</span>
              </label>
            )}
          </div>

          {/* Tier info */}
          <p className="support-tier-info">
            Your ticket will be prioritized based on your subscription tier.
          </p>

          {/* Submit Error */}
          {errors.submit && (
            <div className="support-form-submit-error">{errors.submit}</div>
          )}

          {/* Actions */}
          <div className="support-form-actions">
            <Link to="/portal/support" className="btn ghost">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
