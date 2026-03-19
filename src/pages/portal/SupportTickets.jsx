import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchTickets } from '../../api/support';
import './support-tickets.css';

const STATUS_TABS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
];

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

function priorityLabel(priority) {
  if (priority === 'high') return { text: 'High', color: '#dc2626' };
  if (priority === 'medium') return { text: 'Medium', color: '#d97706' };
  return { text: 'Low', color: '#6b7280' };
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

function categoryLabel(catId) {
  const cat = CATEGORIES.find((c) => c.id === catId);
  return cat ? cat.label : catId;
}

function statusLabel(status) {
  if (status === 'in_progress') return 'In Progress';
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
}

export default function SupportTickets() {
  const { getIdToken } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const data = await fetchTickets({}, token);
      setTickets(Array.isArray(data) ? data : data?.tickets || []);
    } catch (err) {
      console.error('Failed to load tickets:', err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return tickets;
    return tickets.filter((t) => t.status === activeTab);
  }, [tickets, activeTab]);

  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    );
  }, [filtered]);

  return (
    <div className="support-tickets">
      <div className="support-header">
        <h1>Support</h1>
        <Link to="/portal/support/new" className="btn primary">
          New Ticket
        </Link>
      </div>

      <div className="support-tabs">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`support-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="support-loading">
          <div className="section-spinner" />
          <p>Loading tickets...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="support-empty">
          <span className="support-empty-icon">{'\u2709'}</span>
          <h3>
            {activeTab !== 'all'
              ? `No ${statusLabel(activeTab).toLowerCase()} tickets`
              : 'No support tickets yet'}
          </h3>
          <p>
            {activeTab !== 'all'
              ? 'Try a different filter or create a new ticket.'
              : 'Need help? Submit a support request and our team will get back to you.'}
          </p>
          {activeTab === 'all' && (
            <Link to="/portal/support/new" className="btn primary" style={{ marginTop: 16 }}>
              Submit a Request
            </Link>
          )}
        </div>
      ) : (
        <div className="support-ticket-list">
          {sorted.map((ticket) => {
            const sla = slaIndicator(ticket.createdAt, ticket.status);
            const prio = priorityLabel(ticket.priority);

            return (
              <Link
                key={ticket.id}
                to={`/portal/support/${ticket.id}`}
                className="support-ticket-card-link"
              >
                <article className="support-ticket-card">
                  <div className="support-ticket-card-top">
                    <span className="support-ticket-ref">
                      {ticket.refNumber || `HF-${String(ticket.ticketNumber || 0).padStart(5, '0')}`}
                    </span>
                    <div className="support-ticket-badges">
                      {sla && (
                        <span className="support-sla-badge">
                          <span
                            className="support-sla-dot"
                            style={{ background: sla.color }}
                          />
                          {sla.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="support-ticket-title">{ticket.title}</h3>

                  <div className="support-ticket-meta">
                    <span className="support-category-badge">
                      {categoryLabel(ticket.category)}
                    </span>
                    <span
                      className="support-status-badge"
                      style={{
                        background: `${statusColor(ticket.status)}18`,
                        color: statusColor(ticket.status),
                      }}
                    >
                      {statusLabel(ticket.status)}
                    </span>
                    <span
                      className="support-priority-badge"
                      style={{
                        background: `${prio.color}18`,
                        color: prio.color,
                      }}
                    >
                      {prio.text}
                    </span>
                  </div>

                  <div className="support-ticket-footer">
                    <span className="support-ticket-messages">
                      {ticket.messageCount || 0} message{(ticket.messageCount || 0) !== 1 ? 's' : ''}
                    </span>
                    <span className="support-ticket-time">
                      {timeAgo(ticket.updatedAt || ticket.createdAt)}
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
