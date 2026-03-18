import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchThread,
  createReply,
  toggleReaction,
  createReport,
} from '../../api/community';
import { uploadFile } from '../../api/upload';
import LazyImage from '../../components/LazyImage';
import './community-thread.css';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '\u25A4' },
  { id: 'general', label: 'General', icon: '\uD83D\uDCAC' },
  { id: 'workouts', label: 'Workouts', icon: '\u270A' },
  { id: 'exercises', label: 'Exercises', icon: '\uD83C\uDFCB\uFE0F' },
  { id: 'events', label: 'Events', icon: '\uD83D\uDCC5' },
  { id: 'progress', label: 'Progress', icon: '\uD83D\uDCC8' },
  { id: 'tips', label: 'Tips & Mods', icon: '\uD83D\uDCA1' },
];

const REPORT_REASONS = [
  'Spam',
  'Harassment or bullying',
  'Inappropriate content',
  'Misinformation',
  'Other',
];

function tierBadgeClass(tier) {
  if (tier === 'Iron Dassie') return 'tier-badge tier-3';
  if (tier === 'Rock Runner') return 'tier-badge tier-2';
  return 'tier-badge tier-1';
}

function memberDuration(memberSince) {
  if (!memberSince) return '';
  const ms = Date.now() - new Date(memberSince).getTime();
  const months = Math.floor(ms / (30 * 24 * 60 * 60 * 1000));
  if (months < 1) return 'New member';
  if (months === 1) return '1 month';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year' : `${years} years`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function categoryLabel(catId) {
  const cat = CATEGORIES.find((c) => c.id === catId);
  return cat ? `${cat.icon} ${cat.label}` : catId;
}

export default function CommunityThread() {
  const { id } = useParams();
  const { user, getIdToken } = useAuth();
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reply form state
  const [replyContent, setReplyContent] = useState('');
  const [replyImage, setReplyImage] = useState(null);
  const [replyImagePreview, setReplyImagePreview] = useState(null);
  const [replyAnonymous, setReplyAnonymous] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Report state
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const loadThread = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const data = await fetchThread(id, token);
      setThread(data.thread || data);
      setReplies(data.replies || []);
    } catch (err) {
      console.error('Failed to load thread:', err);
    } finally {
      setLoading(false);
    }
  }, [id, getIdToken]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const handleReaction = async (type) => {
    try {
      const token = await getIdToken();
      const result = await toggleReaction(
        { threadId: id, type },
        token
      );
      // Update thread reactions locally
      setThread((prev) => {
        if (!prev) return prev;
        const reactions = { ...prev.reactions };
        if (result.added) {
          reactions[type] = (reactions[type] || 0) + 1;
          reactions[`${type}ByUser`] = true;
        } else {
          reactions[type] = Math.max((reactions[type] || 1) - 1, 0);
          reactions[`${type}ByUser`] = false;
        }
        return { ...prev, reactions };
      });
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const handleReplyImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplyImage(file);
    const reader = new FileReader();
    reader.onload = () => setReplyImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeReplyImage = () => {
    setReplyImage(null);
    setReplyImagePreview(null);
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || submittingReply) return;

    setSubmittingReply(true);
    try {
      const token = await getIdToken();
      let imageUrl = null;

      if (replyImage) {
        const uploaded = await uploadFile(replyImage, token);
        imageUrl = uploaded.publicUrl;
      }

      const data = {
        content: replyContent.trim(),
        anonymous: replyAnonymous,
      };
      if (imageUrl) data.imageUrl = imageUrl;

      const newReply = await createReply(id, data, token);
      setReplies((prev) => [...prev, newReply]);
      setReplyContent('');
      setReplyImage(null);
      setReplyImagePreview(null);
      setReplyAnonymous(false);
    } catch (err) {
      console.error('Failed to create reply:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportReason || submittingReport) return;

    setSubmittingReport(true);
    try {
      const token = await getIdToken();
      await createReport({ threadId: id, reason: reportReason }, token);
      setReportSent(true);
      setShowReport(false);
      setReportReason('');
    } catch (err) {
      console.error('Failed to submit report:', err);
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="community-thread-page">
        <div className="community-thread-loading">
          <div className="section-spinner" />
          <p>Loading thread...</p>
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="community-thread-page">
        <div className="community-thread-loading">
          <p>Thread not found.</p>
          <Link to="/portal/community" className="btn ghost">
            Back to Community
          </Link>
        </div>
      </div>
    );
  }

  const reactions = thread.reactions || {};

  return (
    <div className="community-thread-page">
      <Link to="/portal/community" className="community-back-link">
        &larr; Back to Community
      </Link>

      {/* Thread Header */}
      <article className="community-thread-detail">
        <div className="community-thread-detail-header">
          <div className="community-thread-detail-category">
            <span className="community-thread-category-badge">
              {categoryLabel(thread.category)}
            </span>
            {thread.pinned && (
              <span className="community-pinned" title="Pinned">
                {'\uD83D\uDCCC'} Pinned
              </span>
            )}
          </div>

          <h1 className="community-thread-detail-title">{thread.title}</h1>

          <div className="community-thread-detail-author">
            <span className="community-author-name">
              {thread.anonymous ? 'Anonymous' : thread.authorName || 'Member'}
            </span>
            {!thread.anonymous && thread.authorTier && (
              <span className={tierBadgeClass(thread.authorTier)}>
                {thread.authorTier}
              </span>
            )}
            {!thread.anonymous && thread.memberSince && (
              <span className="community-member-duration">
                {memberDuration(thread.memberSince)}
              </span>
            )}
            <span className="community-thread-detail-date">
              {formatDate(thread.createdAt)}
            </span>
          </div>
        </div>

        {/* Thread Content */}
        <div className="community-thread-detail-content">
          {thread.content?.split('\n').map((line, i) => (
            <p key={i}>{line || '\u00A0'}</p>
          ))}
        </div>

        {thread.imageUrl && (
          <div className="community-thread-detail-image">
            <LazyImage src={thread.imageUrl} alt="Thread attachment" />
          </div>
        )}

        {/* Reactions + Report */}
        <div className="community-thread-detail-actions">
          <div className="community-reactions">
            <button
              className={`community-reaction-btn${reactions.likeByUser ? ' active' : ''}`}
              onClick={() => handleReaction('like')}
            >
              {'\uD83D\uDC4D'} <span>{reactions.like || 0}</span>
            </button>
            <button
              className={`community-reaction-btn${reactions.helpfulByUser ? ' active' : ''}`}
              onClick={() => handleReaction('helpful')}
            >
              {'\u270B'} <span>{reactions.helpful || 0}</span>
            </button>
          </div>

          <div className="community-thread-detail-report">
            {reportSent ? (
              <span className="community-report-sent">Report submitted</span>
            ) : (
              <button
                className="community-report-btn"
                onClick={() => setShowReport(!showReport)}
                title="Report this thread"
              >
                {'\u2691'} Report
              </button>
            )}
          </div>
        </div>

        {/* Report Form (inline) */}
        {showReport && (
          <form className="community-report-form" onSubmit={handleSubmitReport}>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              required
            >
              <option value="">Select a reason...</option>
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <div className="community-report-form-actions">
              <button
                type="submit"
                className="btn primary"
                disabled={!reportReason || submittingReport}
              >
                {submittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setShowReport(false);
                  setReportReason('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </article>

      {/* Replies Section */}
      <section className="community-replies-section">
        <h2 className="community-replies-heading">
          Replies ({replies.length})
        </h2>

        {replies.length === 0 ? (
          <p className="community-replies-empty">
            No replies yet. Be the first to respond!
          </p>
        ) : (
          <div className="community-replies-list">
            {replies.map((reply) => (
              <article key={reply.id} className="community-reply-card">
                <div className="community-reply-author">
                  <span className="community-author-name">
                    {reply.anonymous
                      ? 'Anonymous'
                      : reply.authorName || 'Member'}
                  </span>
                  {!reply.anonymous && reply.authorTier && (
                    <span className={tierBadgeClass(reply.authorTier)}>
                      {reply.authorTier}
                    </span>
                  )}
                  {!reply.anonymous && reply.memberSince && (
                    <span className="community-member-duration">
                      {memberDuration(reply.memberSince)}
                    </span>
                  )}
                  <span className="community-reply-time">
                    {timeAgo(reply.createdAt)}
                  </span>
                </div>

                <div className="community-reply-content">
                  {reply.content?.split('\n').map((line, i) => (
                    <p key={i}>{line || '\u00A0'}</p>
                  ))}
                </div>

                {reply.imageUrl && (
                  <div className="community-reply-image">
                    <LazyImage src={reply.imageUrl} alt="Reply attachment" />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Reply Composer */}
      <section className="community-reply-composer">
        <h3>Write a reply</h3>
        <form onSubmit={handleSubmitReply}>
          <textarea
            className="community-reply-textarea"
            placeholder="Share your thoughts..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={4}
            required
          />

          {replyImagePreview && (
            <div className="community-reply-image-preview">
              <img src={replyImagePreview} alt="Upload preview" />
              <button
                type="button"
                className="community-reply-image-remove"
                onClick={removeReplyImage}
              >
                &times;
              </button>
            </div>
          )}

          <div className="community-reply-composer-actions">
            <div className="community-reply-composer-left">
              <label className="community-reply-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReplyImageChange}
                  hidden
                />
                <span className="btn ghost">{'\uD83D\uDDBC\uFE0F'} Image</span>
              </label>

              <label className="community-anonymous-toggle">
                <input
                  type="checkbox"
                  checked={replyAnonymous}
                  onChange={(e) => setReplyAnonymous(e.target.checked)}
                />
                <span>Post anonymously</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn primary"
              disabled={!replyContent.trim() || submittingReply}
            >
              {submittingReply ? 'Posting...' : 'Post Reply'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
