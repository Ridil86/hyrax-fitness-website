import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchTickets,
  fetchTicket,
  updateTicket,
  addTicketMessage,
  assignTicket,
  fetchSupportStats,
} from '../../api/support';
import { fetchUsers } from '../../api/users';
import './admin.css';
import './support-admin.css';

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'account', label: 'Account' },
  { id: 'billing', label: 'Billing' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'videos', label: 'Videos' },
  { id: 'technical', label: 'Technical' },
  { id: 'general', label: 'General' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
  { value: 'all', label: 'All Priorities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const QUICK_REPLIES = [
  { label: 'Acknowledgment', text: 'Thank you for reaching out. We have received your request and will look into it shortly.' },
  { label: 'More Info', text: 'Thank you for your message. Could you please provide additional details so we can better assist you?' },
  { label: 'Resolved', text: 'We believe this issue has been resolved. Please let us know if you have any further questions or concerns.' },
  { label: 'Billing', text: 'For billing-related changes, please allow 24-48 hours for updates to reflect in your account.' },
  { label: 'Bug Report', text: 'Thank you for reporting this issue. Our team is investigating and we will update you once we have more information.' },
];

const TABS = [
  { id: 'all', label: 'All Tickets' },
  { id: 'active', label: 'Open / In Progress' },
  { id: 'mine', label: 'My Assigned' },
];

function priorityRank(p) {
  return p === 'high' ? 0 : p === 'medium' ? 1 : 2;
}

function slaIndicator(createdAt, status) {
  if (status === 'resolved' || status === 'closed') return null;
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hours < 24) return { color: '#16a34a', label: '< 24h' };
  if (hours < 72) return { color: '#d97706', label: '< 72h' };
  return { color: '#dc2626', label: `${Math.floor(hours / 24)}d` };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  const cls =
    status === 'open'
      ? 'support-status-badge open'
      : status === 'in_progress'
      ? 'support-status-badge in-progress'
      : status === 'resolved'
      ? 'support-status-badge resolved'
      : 'support-status-badge closed';
  const label =
    status === 'in_progress' ? 'In Progress' : status || 'open';
  return <span className={cls}>{label}</span>;
}

function PriorityBadge({ priority }) {
  const cls =
    priority === 'high'
      ? 'support-priority-badge high'
      : priority === 'medium'
      ? 'support-priority-badge medium'
      : 'support-priority-badge low';
  return <span className={cls}>{priority || 'low'}</span>;
}

function TierBadge({ tier }) {
  if (!tier) return null;
  const lower = (tier || '').toLowerCase();
  let cls = 'support-tier-badge';
  if (lower.includes('pup') || lower === 'tier-1' || lower === '1') cls += ' tier-1';
  else if (lower.includes('rock') || lower === 'tier-2' || lower === '2') cls += ' tier-2';
  else if (lower.includes('iron') || lower.includes('dassie') || lower === 'tier-3' || lower === '3') cls += ' tier-3';
  const label =
    lower.includes('pup') || lower === '1' || lower === 'tier-1'
      ? 'Pup'
      : lower.includes('rock') || lower === '2' || lower === 'tier-2'
      ? 'Rock Runner'
      : lower.includes('iron') || lower.includes('dassie') || lower === '3' || lower === 'tier-3'
      ? 'Iron Dassie'
      : tier;
  return <span className={cls}>{label}</span>;
}

function SLADot({ createdAt, status }) {
  const sla = slaIndicator(createdAt, status);
  if (!sla) return null;
  return (
    <span className="support-sla" title={`SLA: ${sla.label}`}>
      <span className="support-sla-dot" style={{ background: sla.color }} />
      <span style={{ color: sla.color }}>{sla.label}</span>
    </span>
  );
}

function CategoryLabel({ category }) {
  const cat = CATEGORIES.find((c) => c.id === category);
  return (
    <span className="support-category-label">
      {cat ? cat.label : category || 'General'}
    </span>
  );
}

export default function SupportAdmin() {
  const { user, getIdToken } = useAuth();
  const adminEmail = user?.email || user?.username || '';

  const [activeTab, setActiveTab] = useState('all');

  // Data
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [search, setSearch] = useState('');

  // Expanded ticket
  const [expandedId, setExpandedId] = useState(null);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Reply composer
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Inline edits
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [assignInput, setAssignInput] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);

  // Admin users for assignment dropdown
  const [adminUsers, setAdminUsers] = useState([]);

  // Feedback
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  const showSuccess = (msg) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  // ── Load tickets ──
  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterPriority !== 'all') params.priority = filterPriority;
      if (filterCategory !== 'all') params.category = filterCategory;
      if (activeTab === 'mine') params.assignedTo = adminEmail;
      const data = await fetchTickets(params, token);
      setTickets(Array.isArray(data) ? data : data.tickets || []);
    } catch (err) {
      setError(err.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, filterStatus, filterPriority, filterCategory, activeTab, adminEmail]);

  // ── Load stats ──
  const loadStats = useCallback(async () => {
    try {
      const token = await getIdToken();
      const data = await fetchSupportStats(token);
      setStats(data);
    } catch {
      // Stats are non-critical
    }
  }, [getIdToken]);

  // ── Load admin users for assignment dropdown ──
  const loadAdminUsers = useCallback(async () => {
    try {
      const token = await getIdToken();
      const data = await fetchUsers({ limit: 60 }, token);
      const users = data.users || [];
      const admins = users
        .filter((u) => (u.groups || []).includes('Admin'))
        .map((u) => ({
          email: u.email || u.username,
          name: [u.givenName, u.familyName].filter(Boolean).join(' ') || u.email || u.username,
        }));
      // Ensure current admin is always in the list
      if (adminEmail && !admins.some((a) => a.email === adminEmail)) {
        admins.push({ email: adminEmail, name: adminEmail });
      }
      setAdminUsers(admins);
    } catch {
      // Fallback: at least include the current admin
      if (adminEmail) {
        setAdminUsers([{ email: adminEmail, name: adminEmail }]);
      }
    }
  }, [getIdToken, adminEmail]);

  useEffect(() => {
    loadTickets();
    loadStats();
    loadAdminUsers();
  }, [loadTickets, loadStats, loadAdminUsers]);

  // ── Load ticket detail ──
  const loadTicketDetail = useCallback(async (id) => {
    setLoadingDetail(true);
    try {
      const token = await getIdToken();
      const data = await fetchTicket(id, token);
      setExpandedTicket(data);
      setEditStatus(data.status || 'open');
      setEditPriority(data.priority || 'low');
      setAssignInput(data.assignedTo || '');
    } catch (err) {
      setError(err.message || 'Failed to load ticket details');
    } finally {
      setLoadingDetail(false);
    }
  }, [getIdToken]);

  const handleToggleExpand = (id) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedTicket(null);
      setReplyText('');
      setIsInternal(false);
    } else {
      setExpandedId(id);
      setExpandedTicket(null);
      setReplyText('');
      setIsInternal(false);
      loadTicketDetail(id);
    }
  };

  // ── Send reply ──
  const handleSendReply = async () => {
    if (!replyText.trim() || !expandedId) return;
    setSendingReply(true);
    try {
      const token = await getIdToken();
      await addTicketMessage(expandedId, {
        content: replyText.trim(),
        internal: isInternal,
      }, token);
      setReplyText('');
      setIsInternal(false);
      showSuccess('Reply sent');
      loadTicketDetail(expandedId);
    } catch (err) {
      setError(err.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  // ── Update ticket (status / priority) ──
  const handleSaveUpdate = async () => {
    if (!expandedId) return;
    setSavingUpdate(true);
    try {
      const token = await getIdToken();
      await updateTicket(expandedId, {
        status: editStatus,
        priority: editPriority,
      }, token);
      showSuccess('Ticket updated');
      loadTicketDetail(expandedId);
      loadTickets();
    } catch (err) {
      setError(err.message || 'Failed to update ticket');
    } finally {
      setSavingUpdate(false);
    }
  };

  // ── Assign ticket ──
  const handleAssign = async (assignTo, assignName) => {
    if (!expandedId) return;
    setSavingUpdate(true);
    try {
      const token = await getIdToken();
      await assignTicket(expandedId, { assignedTo: assignTo, assignedName: assignName || assignTo }, token);
      setAssignInput(assignTo);
      showSuccess(assignTo ? `Assigned to ${assignName || assignTo}` : 'Unassigned');
      loadTicketDetail(expandedId);
      loadTickets();
    } catch (err) {
      setError(err.message || 'Failed to assign ticket');
    } finally {
      setSavingUpdate(false);
    }
  };

  const handleSelfAssign = () => {
    const me = adminUsers.find((a) => a.email === adminEmail);
    handleAssign(adminEmail, me?.name || adminEmail);
  };

  // ── Quick reply ──
  const handleQuickReply = (e) => {
    const val = e.target.value;
    if (!val) return;
    const template = QUICK_REPLIES.find((q) => q.label === val);
    if (template) setReplyText(template.text);
    e.target.value = '';
  };

  // ── Filtering and sorting ──
  const filteredTickets = tickets
    .filter((t) => {
      // Tab-level filters
      if (activeTab === 'active' && t.status !== 'open' && t.status !== 'in_progress') return false;
      if (activeTab === 'mine' && t.assignedTo !== adminEmail) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchRef = (t.ref || t.id || '').toLowerCase().includes(q);
        const matchTitle = (t.title || t.subject || '').toLowerCase().includes(q);
        const matchUser = (t.userName || t.userEmail || '').toLowerCase().includes(q);
        if (!matchRef && !matchTitle && !matchUser) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const pa = priorityRank(a.priority);
      const pb = priorityRank(b.priority);
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  const activeCount = tickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress'
  ).length;

  const myCount = tickets.filter((t) => t.assignedTo === adminEmail).length;

  return (
    <div>
      <div className="admin-page-header">
        <h1>Support Management</h1>
        <p>Manage support tickets, respond to users, and track resolution</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="stat-label">Open Tickets</div>
            <div className="stat-value">{stats.openCount ?? 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">Unassigned</div>
            <div className="stat-value">{stats.unassignedCount ?? 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">High Priority</div>
            <div className="stat-value">{stats.highPriorityCount ?? 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">Resolved</div>
            <div className="stat-value">{stats.resolvedCount ?? 0}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="content-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`content-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setExpandedId(null);
              setExpandedTicket(null);
              setError(null);
              setSaveMsg('');
            }}
          >
            {tab.label}
            {tab.id === 'active' && activeCount > 0 && (
              <span className="support-tab-badge">{activeCount}</span>
            )}
            {tab.id === 'mine' && myCount > 0 && (
              <span className="support-tab-badge">{myCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {error && (
        <div className="support-error">
          {error}
          <button className="btn ghost small" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      {saveMsg && <div className="support-save-msg">{saveMsg}</div>}

      {/* Toolbar */}
      <div className="support-toolbar">
        <div className="support-toolbar-filters">
          <input
            type="text"
            className="support-search-input"
            placeholder="Search ref, title, user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {activeTab === 'all' && (
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          )}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <span className="support-count">
          {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="support-loading">Loading tickets...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="admin-placeholder">
          <div className="admin-placeholder-icon">&#127899;</div>
          <h3>No Tickets Found</h3>
          <p>
            {search || filterStatus !== 'all' || filterPriority !== 'all' || filterCategory !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'No support tickets have been submitted yet.'}
          </p>
        </div>
      ) : (
        <div className="support-ticket-list">
          {filteredTickets.map((ticket) => {
            const isExpanded = expandedId === ticket.id;
            return (
              <div
                key={ticket.id}
                className={`support-ticket-row${isExpanded ? ' expanded' : ''}`}
              >
                {/* Summary row */}
                <div
                  className="support-ticket-summary"
                  onClick={() => handleToggleExpand(ticket.id)}
                >
                  <div className="support-ticket-main">
                    <div className="support-ticket-title-row">
                      <span className="support-ticket-ref">
                        {ticket.ref || `#${(ticket.id || '').slice(-6)}`}
                      </span>
                      <h3>{ticket.title || ticket.subject || 'Untitled'}</h3>
                    </div>
                    <div className="support-ticket-meta">
                      <span className="support-ticket-user">
                        {ticket.userName || ticket.userEmail || 'Unknown'}
                      </span>
                      <TierBadge tier={ticket.userTier} />
                      <CategoryLabel category={ticket.category} />
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                      <SLADot createdAt={ticket.createdAt} status={ticket.status} />
                      {ticket.assignedTo && (
                        <span className="support-assigned-label">
                          {ticket.assignedName || ticket.assignedTo}
                        </span>
                      )}
                      <span className="support-ticket-date">
                        {formatDate(ticket.createdAt)}
                      </span>
                      {(ticket.messageCount != null || ticket.messages) && (
                        <span className="support-msg-count">
                          {ticket.messageCount ?? (ticket.messages || []).length} msg{(ticket.messageCount ?? (ticket.messages || []).length) !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`support-expand-icon${isExpanded ? ' open' : ''}`}>
                    &#9662;
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="support-ticket-detail">
                    {loadingDetail ? (
                      <div className="support-loading">Loading ticket details...</div>
                    ) : expandedTicket ? (
                      <>
                        {/* Description */}
                        {expandedTicket.description && (
                          <div className="support-description">
                            <h4>Description</h4>
                            <p>{expandedTicket.description}</p>
                          </div>
                        )}

                        {/* Conversation thread */}
                        <div className="support-thread">
                          <h4>Conversation</h4>
                          {(expandedTicket.messages || []).length === 0 ? (
                            <p className="support-no-messages">No messages yet.</p>
                          ) : (
                            <div className="support-messages">
                              {(expandedTicket.messages || []).map((msg, i) => (
                                <div
                                  key={msg.id || i}
                                  className={`support-message${msg.internal ? ' internal' : ''}${msg.fromAdmin ? ' from-admin' : ''}`}
                                >
                                  <div className="support-message-header">
                                    <span className="support-message-author">
                                      {msg.authorName || msg.author || 'Unknown'}
                                    </span>
                                    {msg.internal && (
                                      <span className="support-internal-label">Internal Note</span>
                                    )}
                                    <span className="support-message-time">
                                      {formatDateTime(msg.createdAt)}
                                    </span>
                                  </div>
                                  <div className="support-message-body">{msg.message || msg.text || msg.content}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reply composer */}
                        <div className="support-reply-composer">
                          <h4>Reply</h4>
                          <div className="support-reply-toolbar">
                            <label className="support-internal-check">
                              <input
                                type="checkbox"
                                checked={isInternal}
                                onChange={(e) => setIsInternal(e.target.checked)}
                              />
                              <span>Internal note</span>
                            </label>
                            <select
                              className="support-quick-reply-select"
                              onChange={handleQuickReply}
                              defaultValue=""
                            >
                              <option value="" disabled>Quick reply...</option>
                              {QUICK_REPLIES.map((qr) => (
                                <option key={qr.label} value={qr.label}>{qr.label}</option>
                              ))}
                            </select>
                          </div>
                          <textarea
                            className="support-reply-textarea"
                            rows={4}
                            placeholder={isInternal ? 'Write an internal note...' : 'Write a reply...'}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                          <button
                            className="btn primary small"
                            disabled={sendingReply || !replyText.trim()}
                            onClick={handleSendReply}
                          >
                            {sendingReply ? 'Sending...' : isInternal ? 'Add Note' : 'Send Reply'}
                          </button>
                        </div>

                        {/* Ticket management */}
                        <div className="support-manage-section">
                          <h4>Manage Ticket</h4>
                          <div className="support-manage-grid">
                            <div className="support-manage-field">
                              <label>Status</label>
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                            </div>
                            <div className="support-manage-field">
                              <label>Priority</label>
                              <select
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value)}
                              >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                            </div>
                            <div className="support-manage-field">
                              <label>Assigned To</label>
                              {expandedTicket.assignedTo && (
                                <div className="support-current-assigned">
                                  Currently assigned to: <strong>{expandedTicket.assignedName || expandedTicket.assignedTo}</strong>
                                </div>
                              )}
                              <div className="support-assign-row">
                                <select
                                  value={assignInput}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAssignInput(val);
                                    const admin = adminUsers.find((a) => a.email === val);
                                    handleAssign(val, admin?.name || val);
                                  }}
                                >
                                  <option value="">Unassigned</option>
                                  {adminUsers.map((a) => (
                                    <option key={a.email} value={a.email}>
                                      {a.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="btn ghost small"
                                  onClick={handleSelfAssign}
                                  disabled={savingUpdate}
                                >
                                  Self-assign
                                </button>
                              </div>
                            </div>
                          </div>
                          <button
                            className="btn primary small"
                            onClick={handleSaveUpdate}
                            disabled={savingUpdate}
                          >
                            {savingUpdate ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
