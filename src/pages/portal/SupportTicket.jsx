import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchTicket, updateTicket, addTicketMessage } from '../../api/support';
import { uploadUserFile } from '../../api/upload';
import LazyImage from '../../components/LazyImage';
import './support-ticket.css';

const CATEGORIES = [
  { id: 'account', label: 'Account' },
  { id: 'billing', label: 'Billing' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'videos', label: 'Videos' },
  { id: 'technical', label: 'Technical' },
  { id: 'general', label: 'General' },
];

function statusColor(status) {
  if (status === 'open') return '#2563eb';
  if (status === 'in_progress') return '#d97706';
  if (status === 'resolved') return '#16a34a';
  if (status === 'closed') return '#6b7280';
  return '#6b7280';
}


function slaIndicator(createdAt, status) {
  if (status === 'resolved' || status === 'closed') return null;
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hours < 24) return { color: '#16a34a', label: '< 24h' };
  if (hours < 72) return { color: '#d97706', label: '< 72h' };
  return { color: '#dc2626', label: `${Math.floor(hours / 24)}d` };
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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
  return cat ? cat.label : catId;
}

function statusLabel(status) {
  if (status === 'in_progress') return 'In Progress';
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
}

export default function SupportTicket() {
  const { id } = useParams();
  const { getIdToken } = useAuth();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reply form
  const [replyContent, setReplyContent] = useState('');
  const [replyImage, setReplyImage] = useState(null);
  const [replyImagePreview, setReplyImagePreview] = useState(null);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const threadEndRef = useRef(null);

  const loadTicket = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const data = await fetchTicket(id, token);
      setTicket(data.ticket || data);
      setMessages(data.messages || []);
    } catch (err) {
      console.error('Failed to load ticket:', err);
    } finally {
      setLoading(false);
    }
  }, [id, getIdToken]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  const scrollToBottom = () => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplyImage(file);
    const reader = new FileReader();
    reader.onload = () => setReplyImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setReplyImage(null);
    setReplyImagePreview(null);
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || submittingReply) return;

    setSubmittingReply(true);
    try {
      const token = await getIdToken();
      let attachmentUrl = null;

      if (replyImage) {
        const uploaded = await uploadUserFile(replyImage, token);
        attachmentUrl = uploaded.publicUrl;
      }

      const data = { content: replyContent.trim() };
      if (attachmentUrl) data.attachmentUrl = attachmentUrl;

      const newMessage = await addTicketMessage(id, data, token);
      setMessages((prev) => [...prev, newMessage]);
      setReplyContent('');
      setReplyImage(null);
      setReplyImagePreview(null);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const token = await getIdToken();
      await updateTicket(id, { status: newStatus }, token);
      setTicket((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="support-ticket-page">
        <div className="support-ticket-loading">
          <div className="section-spinner" />
          <p>Loading ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="support-ticket-page">
        <div className="support-ticket-loading">
          <p>Ticket not found.</p>
          <Link to="/portal/support" className="btn ghost">
            Back to Support
          </Link>
        </div>
      </div>
    );
  }

  const sla = slaIndicator(ticket.createdAt, ticket.status);
  const refNumber = ticket.refNumber || `HF-${String(ticket.ticketNumber || 0).padStart(5, '0')}`;
  const isOpenOrProgress = ticket.status === 'open' || ticket.status === 'in_progress';
  const isResolved = ticket.status === 'resolved';

  return (
    <div className="support-ticket-page">
      <Link to="/portal/support" className="support-back-link">
        &larr; Back to Support
      </Link>

      {/* Ticket Header */}
      <div className="support-ticket-header-card">
        <div className="support-ticket-header-top">
          <span className="support-ticket-header-ref">{refNumber}</span>
          <span className="support-ticket-header-date">{formatDate(ticket.createdAt)}</span>
        </div>

        <h1 className="support-ticket-header-title">{ticket.title}</h1>

        <div className="support-ticket-header-badges">
          <span
            className="support-status-badge"
            style={{
              background: `${statusColor(ticket.status)}18`,
              color: statusColor(ticket.status),
            }}
          >
            {statusLabel(ticket.status)}
          </span>
          <span className="support-category-badge">
            {categoryLabel(ticket.category)}
          </span>
          {sla && (
            <span className="support-sla-indicator">
              <span className="support-sla-dot" style={{ background: sla.color }} />
              {sla.label}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="support-ticket-actions">
          {isOpenOrProgress && (
            <button
              className="btn ghost"
              onClick={() => handleStatusUpdate('closed')}
              disabled={updatingStatus}
            >
              {updatingStatus ? 'Updating...' : 'Close Ticket'}
            </button>
          )}
          {isResolved && (
            <button
              className="btn ghost"
              onClick={() => handleStatusUpdate('open')}
              disabled={updatingStatus}
            >
              {updatingStatus ? 'Updating...' : 'Reopen Ticket'}
            </button>
          )}
        </div>
      </div>

      {/* Conversation Thread */}
      <section className="support-thread">
        <h2 className="support-thread-heading">Conversation</h2>

        <div className="support-thread-messages">
          {/* Original description as first message */}
          <article className="support-message support-message-user">
            <div className="support-message-header">
              <span className="support-message-author">You</span>
              <span className="support-message-time">{timeAgo(ticket.createdAt)}</span>
            </div>
            <div className="support-message-content">
              {ticket.description?.split('\n').map((line, i) => (
                <p key={i}>{line || '\u00A0'}</p>
              ))}
            </div>
            {ticket.attachmentUrl && (
              <div className="support-message-attachment">
                <LazyImage src={ticket.attachmentUrl} alt="Ticket attachment" />
              </div>
            )}
          </article>

          {/* Thread messages */}
          {messages.map((msg) => {
            const isAdmin = msg.authorType === 'admin' || msg.senderType === 'admin';
            return (
              <article
                key={msg.id}
                className={`support-message ${isAdmin ? 'support-message-admin' : 'support-message-user'}`}
              >
                <div className="support-message-header">
                  <span className="support-message-author">
                    {isAdmin ? 'Support Team' : 'You'}
                  </span>
                  <span className={`support-message-type-tag ${isAdmin ? 'admin' : 'user'}`}>
                    {isAdmin ? 'Staff' : 'You'}
                  </span>
                  <span className="support-message-time">{timeAgo(msg.createdAt)}</span>
                </div>
                <div className="support-message-content">
                  {msg.content?.split('\n').map((line, i) => (
                    <p key={i}>{line || '\u00A0'}</p>
                  ))}
                </div>
                {msg.attachmentUrl && (
                  <div className="support-message-attachment">
                    <LazyImage src={msg.attachmentUrl} alt="Message attachment" />
                  </div>
                )}
              </article>
            );
          })}

          <div ref={threadEndRef} />
        </div>
      </section>

      {/* Reply Composer */}
      {ticket.status !== 'closed' && (
        <section className="support-reply-composer">
          <h3>Reply</h3>
          <form onSubmit={handleSubmitReply}>
            <textarea
              className="support-reply-textarea"
              placeholder="Type your message..."
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={4}
              required
            />

            {replyImagePreview && (
              <div className="support-reply-image-preview">
                <img src={replyImagePreview} alt="Upload preview" />
                <button
                  type="button"
                  className="support-reply-image-remove"
                  onClick={removeImage}
                >
                  &times;
                </button>
              </div>
            )}

            <div className="support-reply-actions">
              <label className="support-reply-upload-btn">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  hidden
                />
                <span className="btn ghost">Attach Image</span>
              </label>

              <button
                type="submit"
                className="btn primary"
                disabled={!replyContent.trim() || submittingReply}
              >
                {submittingReply ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
