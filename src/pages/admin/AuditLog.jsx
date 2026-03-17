import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchAuditLogs, fetchAuditStats } from '../../api/audit';
import './admin.css';
import './audit-admin.css';

const EVENT_FILTERS = [
  { value: '', label: 'All Events' },
  { value: 'COOKIE_ACCEPT', label: 'Cookie Accept' },
  { value: 'COOKIE_REJECT', label: 'Cookie Reject' },
];

const PAGE_SIZE = 50;

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function eventBadgeClass(eventType) {
  if (eventType === 'COOKIE_ACCEPT') return 'audit-event accept';
  if (eventType === 'COOKIE_REJECT') return 'audit-event reject';
  return 'audit-event';
}

function eventLabel(eventType) {
  if (eventType === 'COOKIE_ACCEPT') return 'Accept';
  if (eventType === 'COOKIE_REJECT') return 'Reject';
  return eventType;
}

export default function AuditLog() {
  const { getIdToken } = useAuth();

  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [nextToken, setNextToken] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (eventType, append = false, token = null) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const authToken = await getIdToken();
      const opts = { limit: PAGE_SIZE };
      if (eventType) opts.eventType = eventType;
      if (token) opts.nextToken = token;

      const [statsResult, logsResult] = append
        ? [null, await fetchAuditLogs(opts, authToken)]
        : await Promise.allSettled([
            fetchAuditStats(authToken),
            fetchAuditLogs(opts, authToken),
          ]).then(([s, l]) => [
            s.status === 'fulfilled' ? s.value : null,
            l.status === 'fulfilled' ? l.value : null,
          ]);

      if (!append && statsResult) setStats(statsResult);

      if (logsResult) {
        if (append) {
          setLogs(prev => [...prev, ...(logsResult.items || [])]);
        } else {
          setLogs(logsResult.items || []);
        }
        setNextToken(logsResult.nextToken || null);
      } else if (!logsResult && !append) {
        setError('Failed to load audit logs');
      }
    } catch {
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadData(filter);
  }, [filter, loadData]);

  const handleLoadMore = () => {
    if (nextToken) loadData(filter, true, nextToken);
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Audit Log</h1>
        <p>Compliance events and consent tracking</p>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="stat-label">Total Events</div>
          <div className="stat-value">
            {loading ? <span className="stat-loading" /> : (stats?.total ?? '--')}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Cookie Accepts</div>
          <div className="stat-value audit-accept-val">
            {loading ? <span className="stat-loading" /> : (stats?.accepts ?? '--')}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Cookie Rejects</div>
          <div className="stat-value audit-reject-val">
            {loading ? <span className="stat-loading" /> : (stats?.rejects ?? '--')}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="audit-filter-bar">
        <label htmlFor="audit-filter">Filter by event:</label>
        <select
          id="audit-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {EVENT_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="audit-error">
          <p>{error}</p>
          <button className="btn" onClick={() => loadData(filter)}>Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="audit-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Event</th>
              <th>Value</th>
              <th className="audit-col-ua">User Agent</th>
              <th className="audit-col-ip">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="audit-skeleton-row">
                  <td><span className="audit-skeleton" /></td>
                  <td><span className="audit-skeleton short" /></td>
                  <td><span className="audit-skeleton short" /></td>
                  <td className="audit-col-ua"><span className="audit-skeleton" /></td>
                  <td className="audit-col-ip"><span className="audit-skeleton short" /></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="audit-empty">No audit events found</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.sk}>
                  <td>{formatDate(log.createdAt)}</td>
                  <td>
                    <span className={eventBadgeClass(log.eventType)}>
                      {eventLabel(log.eventType)}
                    </span>
                  </td>
                  <td>{log.consentValue || '--'}</td>
                  <td className="audit-col-ua audit-ua-cell" title={log.userAgent || ''}>
                    {log.userAgent || '--'}
                  </td>
                  <td className="audit-col-ip">{log.ipAddress || '--'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {nextToken && !loading && (
        <div className="audit-load-more">
          <button className="btn" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}
