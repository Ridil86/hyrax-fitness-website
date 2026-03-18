import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchThreads,
  fetchAdminQueue,
  moderateThread,
  deleteThreadApi,
  resolveReport,
  togglePin,
  fetchCommunityStats,
} from '../../api/community';
import './admin.css';
import './community-admin.css';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'exercises', label: 'Exercises' },
  { id: 'events', label: 'Events' },
  { id: 'progress', label: 'Progress' },
  { id: 'tips', label: 'Tips & Mods' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'approved', label: 'Approved' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'rejected', label: 'Rejected' },
];

const TABS = [
  { id: 'threads', label: 'All Threads' },
  { id: 'moderation', label: 'Moderation Queue' },
  { id: 'reports', label: 'Reports' },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }) {
  const cls =
    status === 'approved'
      ? 'community-status-badge approved'
      : status === 'hidden'
      ? 'community-status-badge hidden'
      : status === 'rejected'
      ? 'community-status-badge rejected'
      : 'community-status-badge pending';
  return <span className={cls}>{status || 'pending'}</span>;
}

function CategoryBadge({ category }) {
  const cat = CATEGORIES.find((c) => c.id === category);
  return (
    <span className="workout-badge category">{cat ? cat.label : category}</span>
  );
}

export default function CommunityAdmin() {
  const { getIdToken } = useAuth();
  const [activeTab, setActiveTab] = useState('threads');

  // Threads state
  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);

  // Moderation queue state
  const [queue, setQueue] = useState([]);
  const [reports, setReports] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Stats
  const [stats, setStats] = useState(null);

  // Feedback
  const [error, setError] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  // ── Load threads ──
  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    setError(null);
    try {
      const token = await getIdToken();
      const params = {};
      if (filterCategory !== 'all') params.category = filterCategory;
      if (search.trim()) params.search = search.trim();
      const data = await fetchThreads(params, token);
      setThreads(Array.isArray(data) ? data : data.threads || []);
    } catch (err) {
      setError(err.message || 'Failed to load threads');
    } finally {
      setLoadingThreads(false);
    }
  }, [getIdToken, filterCategory, search]);

  // ── Load moderation queue + reports ──
  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    setError(null);
    try {
      const token = await getIdToken();
      const data = await fetchAdminQueue(token);
      setQueue(data.threads || []);
      setReports(data.reports || []);
    } catch (err) {
      setError(err.message || 'Failed to load moderation queue');
    } finally {
      setLoadingQueue(false);
    }
  }, [getIdToken]);

  // ── Load stats ──
  const loadStats = useCallback(async () => {
    try {
      const token = await getIdToken();
      const data = await fetchCommunityStats(token);
      setStats(data);
    } catch {
      // Stats are non-critical, fail silently
    }
  }, [getIdToken]);

  useEffect(() => {
    loadThreads();
    loadStats();
  }, [loadThreads, loadStats]);

  useEffect(() => {
    if (activeTab === 'moderation' || activeTab === 'reports') {
      loadQueue();
    }
  }, [activeTab, loadQueue]);

  // ── Helpers ──
  const showSuccess = (msg) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  // ── Thread actions ──
  const handleModerate = async (id, status) => {
    try {
      const token = await getIdToken();
      await moderateThread(id, { status }, token);
      showSuccess(`Thread ${status}`);
      loadThreads();
      if (activeTab === 'moderation') loadQueue();
    } catch (err) {
      setError(err.message || 'Failed to moderate thread');
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = await getIdToken();
      await deleteThreadApi(id, token);
      setConfirmDelete(null);
      showSuccess('Thread deleted');
      loadThreads();
      if (activeTab === 'moderation') loadQueue();
    } catch (err) {
      setError(err.message || 'Failed to delete thread');
    }
  };

  const handleTogglePin = async (id) => {
    try {
      const token = await getIdToken();
      await togglePin(id, token);
      showSuccess('Pin toggled');
      loadThreads();
    } catch (err) {
      setError(err.message || 'Failed to toggle pin');
    }
  };

  // ── Bulk actions ──
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelected(new Set(filteredThreads.map((t) => t.id)));
    } else {
      setSelected(new Set());
    }
  };

  const handleSelectThread = (id, checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    try {
      const token = await getIdToken();
      const ids = [...selected];
      for (const id of ids) {
        await deleteThreadApi(id, token);
      }
      setSelected(new Set());
      setBulkAction(null);
      showSuccess(`${ids.length} thread${ids.length !== 1 ? 's' : ''} deleted`);
      loadThreads();
    } catch (err) {
      setError(err.message || 'Failed to delete threads');
    }
  };

  const handleBulkHide = async () => {
    if (selected.size === 0) return;
    try {
      const token = await getIdToken();
      const ids = [...selected];
      for (const id of ids) {
        await moderateThread(id, { status: 'hidden' }, token);
      }
      setSelected(new Set());
      setBulkAction(null);
      showSuccess(`${ids.length} thread${ids.length !== 1 ? 's' : ''} hidden`);
      loadThreads();
    } catch (err) {
      setError(err.message || 'Failed to hide threads');
    }
  };

  // ── Report actions ──
  const handleResolveReport = async (id, resolution) => {
    try {
      const token = await getIdToken();
      await resolveReport(id, { resolution }, token);
      showSuccess(`Report ${resolution}`);
      loadQueue();
    } catch (err) {
      setError(err.message || 'Failed to resolve report');
    }
  };

  // ── Filtered threads ──
  const filteredThreads = threads.filter((t) => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    return true;
  });

  const pendingQueueCount = queue.length;
  const pendingReportsCount = reports.filter(
    (r) => !r.resolution || r.resolution === 'pending'
  ).length;

  return (
    <div>
      <div className="admin-page-header">
        <h1>Community Management</h1>
        <p>Moderate threads, review reports, and manage community content</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="admin-stats">
          <div className="admin-stat-card">
            <div className="stat-label">Total Threads</div>
            <div className="stat-value">{stats.totalThreads ?? 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">Total Replies</div>
            <div className="stat-value">{stats.totalReplies ?? 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">Active Users</div>
            <div className="stat-value">{stats.activeUsers ?? 0}</div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-label">Pending Reports</div>
            <div className="stat-value">{pendingReportsCount}</div>
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
              setError(null);
              setSaveMsg('');
            }}
          >
            {tab.label}
            {tab.id === 'moderation' && pendingQueueCount > 0 && (
              <span className="community-tab-badge">{pendingQueueCount}</span>
            )}
            {tab.id === 'reports' && pendingReportsCount > 0 && (
              <span className="community-tab-badge">{pendingReportsCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {error && (
        <div className="faq-admin-error" style={{ marginTop: 12 }}>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      {saveMsg && <div className="content-save-msg">{saveMsg}</div>}

      {/* ── Tab 1: All Threads ── */}
      {activeTab === 'threads' && (
        <div>
          {/* Toolbar */}
          <div className="community-toolbar">
            <div className="community-toolbar-filters">
              <input
                type="text"
                className="community-search-input"
                placeholder="Search threads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadThreads();
                }}
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id === 'all' ? 'All Categories' : c.label}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button className="btn ghost small" onClick={loadThreads}>
                Search
              </button>
            </div>

            <span className="workout-admin-count">
              {filteredThreads.length} thread
              {filteredThreads.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="community-bulk-bar">
              <span className="community-bulk-count">
                {selected.size} selected
              </span>
              {bulkAction === 'delete' ? (
                <div className="workout-confirm-delete">
                  <span>Delete {selected.size} thread{selected.size !== 1 ? 's' : ''}?</span>
                  <button className="btn ghost small danger" onClick={handleBulkDelete}>
                    Yes, Delete
                  </button>
                  <button className="btn ghost small" onClick={() => setBulkAction(null)}>
                    Cancel
                  </button>
                </div>
              ) : bulkAction === 'hide' ? (
                <div className="workout-confirm-delete">
                  <span>Hide {selected.size} thread{selected.size !== 1 ? 's' : ''}?</span>
                  <button className="btn ghost small" onClick={handleBulkHide}>
                    Yes, Hide
                  </button>
                  <button className="btn ghost small" onClick={() => setBulkAction(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="community-bulk-actions">
                  <button
                    className="btn ghost small"
                    onClick={() => setBulkAction('hide')}
                  >
                    Hide Selected
                  </button>
                  <button
                    className="btn ghost small danger"
                    onClick={() => setBulkAction('delete')}
                  >
                    Delete Selected
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Thread list */}
          {loadingThreads ? (
            <div className="faq-admin-loading">Loading threads...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="admin-placeholder">
              <div className="admin-placeholder-icon">&#128172;</div>
              <h3>No Threads Found</h3>
              <p>
                {search || filterCategory !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your filters or search query.'
                  : 'No community threads have been created yet.'}
              </p>
            </div>
          ) : (
            <div className="community-thread-list">
              {/* Select all header */}
              <div className="community-thread-header">
                <label className="community-checkbox-label">
                  <input
                    type="checkbox"
                    checked={
                      filteredThreads.length > 0 &&
                      selected.size === filteredThreads.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                  <span>Select All</span>
                </label>
              </div>

              {filteredThreads.map((thread) => (
                <div
                  key={thread.id}
                  className={`community-thread-card${
                    thread.pinned ? ' pinned' : ''
                  }`}
                >
                  <div className="community-thread-select">
                    <input
                      type="checkbox"
                      checked={selected.has(thread.id)}
                      onChange={(e) =>
                        handleSelectThread(thread.id, e.target.checked)
                      }
                    />
                  </div>

                  <div className="community-thread-info">
                    <div className="community-thread-title-row">
                      {thread.pinned && (
                        <span className="community-pin-icon" title="Pinned">
                          &#128204;
                        </span>
                      )}
                      <h3>{thread.title}</h3>
                    </div>

                    <div className="community-thread-meta">
                      <span className="community-author">
                        {thread.authorName || thread.author || 'Unknown'}
                        {thread.anonymous && (
                          <span className="community-anon-label">
                            {' '}
                            (Anonymous)
                          </span>
                        )}
                      </span>
                      <CategoryBadge category={thread.category} />
                      <StatusBadge status={thread.status} />
                      <span className="community-date">
                        {formatDate(thread.createdAt)}
                      </span>
                      <span className="community-replies">
                        {thread.replyCount ?? 0} repl
                        {(thread.replyCount ?? 0) === 1 ? 'y' : 'ies'}
                      </span>
                    </div>
                  </div>

                  <div className="community-thread-actions">
                    <button
                      className="btn ghost small"
                      onClick={() => handleTogglePin(thread.id)}
                      title={thread.pinned ? 'Unpin thread' : 'Pin thread'}
                    >
                      {thread.pinned ? 'Unpin' : 'Pin'}
                    </button>

                    {thread.status !== 'hidden' ? (
                      <button
                        className="btn ghost small"
                        onClick={() => handleModerate(thread.id, 'hidden')}
                      >
                        Hide
                      </button>
                    ) : (
                      <button
                        className="btn ghost small"
                        onClick={() => handleModerate(thread.id, 'approved')}
                      >
                        Unhide
                      </button>
                    )}

                    {confirmDelete === thread.id ? (
                      <div className="workout-confirm-delete">
                        <span>Delete?</span>
                        <button
                          className="btn ghost small danger"
                          onClick={() => handleDelete(thread.id)}
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
                        onClick={() => setConfirmDelete(thread.id)}
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
      )}

      {/* ── Tab 2: Moderation Queue ── */}
      {activeTab === 'moderation' && (
        <div>
          {loadingQueue ? (
            <div className="faq-admin-loading">Loading moderation queue...</div>
          ) : queue.length === 0 ? (
            <div className="admin-placeholder">
              <div className="admin-placeholder-icon">&#9989;</div>
              <h3>Queue is Clear</h3>
              <p>No threads need moderation right now.</p>
            </div>
          ) : (
            <div className="community-queue-list">
              {queue.map((item) => (
                <div key={item.id} className="community-queue-card">
                  <div className="community-queue-info">
                    <h3>{item.title}</h3>
                    <p className="community-queue-preview">
                      {item.content
                        ? item.content.length > 200
                          ? item.content.slice(0, 200) + '...'
                          : item.content
                        : 'No content preview available.'}
                    </p>
                    <div className="community-thread-meta">
                      <span className="community-author">
                        {item.authorName || item.author || 'Unknown'}
                        {item.anonymous && (
                          <span className="community-anon-label">
                            {' '}
                            (Anonymous)
                          </span>
                        )}
                      </span>
                      <CategoryBadge category={item.category} />
                      <StatusBadge status={item.status} />
                      <span className="community-date">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="community-queue-actions">
                    <button
                      className="btn primary small"
                      onClick={() => handleModerate(item.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn ghost small"
                      onClick={() => handleModerate(item.id, 'rejected')}
                    >
                      Reject
                    </button>
                    <button
                      className="btn ghost small danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Reports ── */}
      {activeTab === 'reports' && (
        <div>
          {loadingQueue ? (
            <div className="faq-admin-loading">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="admin-placeholder">
              <div className="admin-placeholder-icon">&#128101;</div>
              <h3>No Reports</h3>
              <p>No content has been flagged by users.</p>
            </div>
          ) : (
            <div className="community-reports-list">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`community-report-card${
                    report.resolution && report.resolution !== 'pending'
                      ? ' resolved'
                      : ''
                  }`}
                >
                  <div className="community-report-info">
                    <div className="community-report-header">
                      <span className="community-report-type">
                        {report.targetType === 'reply' ? 'Reply' : 'Thread'}{' '}
                        Report
                      </span>
                      {report.resolution && report.resolution !== 'pending' && (
                        <span className="community-report-resolved-badge">
                          {report.resolution}
                        </span>
                      )}
                    </div>
                    <div className="community-report-details">
                      <div className="community-report-row">
                        <span className="community-report-label">Reporter:</span>
                        <span>{report.reporterEmail || report.reporter || 'Unknown'}</span>
                      </div>
                      <div className="community-report-row">
                        <span className="community-report-label">Reason:</span>
                        <span>{report.reason || 'No reason provided'}</span>
                      </div>
                      <div className="community-report-row">
                        <span className="community-report-label">Date:</span>
                        <span>{formatDate(report.createdAt)}</span>
                      </div>
                      {report.targetTitle && (
                        <div className="community-report-row">
                          <span className="community-report-label">Target:</span>
                          <span>{report.targetTitle}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {(!report.resolution || report.resolution === 'pending') && (
                    <div className="community-report-actions">
                      <button
                        className="btn primary small"
                        onClick={() =>
                          handleResolveReport(report.id, 'resolved')
                        }
                      >
                        Resolve
                      </button>
                      <button
                        className="btn ghost small"
                        onClick={() =>
                          handleResolveReport(report.id, 'dismissed')
                        }
                      >
                        Dismiss
                      </button>
                      {report.threadId && (
                        <a
                          href={`/community/thread/${report.threadId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn ghost small"
                        >
                          View Thread
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
