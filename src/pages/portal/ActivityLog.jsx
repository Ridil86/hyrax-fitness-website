import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchUserLogs, fetchLogStats, deleteLogApi } from '../../api/completionLog';
import { fetchProfile } from '../../api/profile';
import { hasTierAccess, getEffectiveTier } from '../../utils/tiers';
import './activity-log.css';
import './portal-dashboard.css';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function difficultyColor(diff) {
  if (diff === 'beginner') return '#16a34a';
  if (diff === 'intermediate') return '#d97706';
  if (diff === 'advanced') return '#dc2626';
  return '#6b7280';
}

function rpeLabel(rpe) {
  if (!rpe) return null;
  if (rpe <= 3) return 'Easy';
  if (rpe <= 5) return 'Moderate';
  if (rpe <= 7) return 'Hard';
  return 'Max Effort';
}

export default function ActivityLog() {
  const { getIdToken } = useAuth();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [expandedSessions, setExpandedSessions] = useState({});
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Fetch profile for tier check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (token) {
          const result = await fetchProfile(token);
          if (!cancelled) setProfile(result);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getIdToken]);

  const locked = !profileLoading && !hasTierAccess(getEffectiveTier(profile), 'Rock Runner');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const params = {};
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;
      const [logsData, statsData] = await Promise.all([
        fetchUserLogs(params, token),
        fetchLogStats(token),
      ]);
      setLogs(Array.isArray(logsData) ? logsData : logsData?.logs || []);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, fromDate, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (logId) => {
    if (confirmDeleteId !== logId) {
      setConfirmDeleteId(logId);
      return;
    }
    setDeletingId(logId);
    try {
      const token = await getIdToken();
      await deleteLogApi(logId, token);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete log:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
    setSearch('');
  };

  const hasFilters = fromDate || toDate || search;

  // Filter by search term
  const filtered = search
    ? logs.filter((l) =>
        (l.exerciseName || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  // Group by sessionId
  const groups = [];
  const sessionMap = {};
  filtered.forEach((log) => {
    const key = log.sessionId || log.id;
    if (log.sessionId && sessionMap[key] !== undefined) {
      groups[sessionMap[key]].entries.push(log);
    } else {
      sessionMap[key] = groups.length;
      groups.push({
        sessionId: log.sessionId || null,
        workoutTitle: log.workoutTitle || null,
        date: log.completedAt || log.createdAt,
        entries: [log],
      });
    }
  });

  // Sort groups by date descending
  groups.sort((a, b) => new Date(b.date) - new Date(a.date));

  const toggleSession = (sessionId) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  if (profileLoading) {
    return (
      <div className="activity-log">
        <div className="activity-log-loading">
          <div className="section-spinner" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="activity-log">
        <div className="activity-log-header">
          <h1>Activity Log</h1>
        </div>
        <div className="portal-tier-gate">
          <span className="portal-tier-gate-icon">{'\u{1F512}'}</span>
          <h2>Upgrade to Rock Runner</h2>
          <p>Track your activity log and monitor workout sessions with a Rock Runner or higher subscription.</p>
          <Link to="/portal/subscription" className="btn primary">Upgrade Account</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-log">
      <div className="activity-log-header">
        <h1>Activity Log</h1>
      </div>

      {/* Stats */}
      {stats && (
        <div className="activity-log-stats">
          <div className="activity-log-stat-card">
            <span className="activity-log-stat-value">{stats.totalLogs || 0}</span>
            <span className="activity-log-stat-label">Total Logs</span>
          </div>
          <div className="activity-log-stat-card">
            <span className="activity-log-stat-value">{stats.currentStreak || 0}</span>
            <span className="activity-log-stat-label">Day Streak</span>
          </div>
          <div className="activity-log-stat-card">
            <span className="activity-log-stat-value">{stats.uniqueExercises || 0}</span>
            <span className="activity-log-stat-label">Unique Exercises</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="activity-log-filters">
        <input
          type="date"
          className="activity-log-date-input"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          placeholder="From"
        />
        <input
          type="date"
          className="activity-log-date-input"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          placeholder="To"
        />
        <input
          type="text"
          className="activity-log-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercise..."
        />
        {hasFilters && (
          <button className="activity-log-clear-btn" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="activity-log-loading">
          <div className="section-spinner" />
          <p>Loading activity...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="activity-log-empty">
          <span className="activity-log-empty-icon">{'\u{1F4CA}'}</span>
          <h3>No activity logged yet</h3>
          <p>
            Complete a workout or exercise to start tracking your progress!
          </p>
        </div>
      ) : (
        <div className="activity-log-list">
          {groups.map((group) => {
            const isSession = group.sessionId && group.entries.length > 1;
            const sessionKey = group.sessionId || group.entries[0]?.id;
            const isExpanded = expandedSessions[sessionKey] !== false; // default open

            if (isSession) {
              return (
                <div key={sessionKey} className="activity-log-session">
                  <button
                    className="activity-log-session-header"
                    onClick={() => toggleSession(sessionKey)}
                  >
                    <div className="activity-log-session-info">
                      <span className="activity-log-session-icon">
                        {isExpanded ? '\u25BC' : '\u25B6'}
                      </span>
                      <div>
                        <h3>
                          {group.workoutTitle || 'Workout Session'}
                        </h3>
                        <span className="activity-log-session-meta">
                          {group.entries.length} exercises &middot;{' '}
                          {formatDate(group.date)}
                        </span>
                      </div>
                    </div>
                    <span className="activity-log-session-time">
                      {timeAgo(group.date)}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="activity-log-session-entries">
                      {group.entries.map((log) => (
                        <LogEntry
                          key={log.id}
                          log={log}
                          onDelete={handleDelete}
                          deletingId={deletingId}
                          confirmDeleteId={confirmDeleteId}
                          onCancelDelete={() => setConfirmDeleteId(null)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <LogEntry
                key={group.entries[0]?.id}
                log={group.entries[0]}
                onDelete={handleDelete}
                deletingId={deletingId}
                confirmDeleteId={confirmDeleteId}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function LogEntry({ log, onDelete, deletingId, confirmDeleteId, onCancelDelete }) {
  const isConfirming = confirmDeleteId === log.id;
  const isDeleting = deletingId === log.id;

  return (
    <article className="activity-log-entry">
      <div className="activity-log-entry-top">
        <h4 className="activity-log-exercise-name">{log.exerciseName || 'Exercise'}</h4>
        {log.difficulty && (
          <span
            className="activity-log-diff-badge"
            style={{
              background: `${difficultyColor(log.difficulty)}18`,
              color: difficultyColor(log.difficulty),
            }}
          >
            {log.difficulty}
          </span>
        )}
      </div>

      <div className="activity-log-entry-stats">
        {(log.sets || log.reps) && (
          <div className="activity-log-stat">
            <span className="activity-log-stat-key">Sets x Reps</span>
            <span className="activity-log-stat-val">
              {log.sets || 0} &times; {log.reps || 0}
            </span>
          </div>
        )}
        {log.weight != null && log.weight > 0 && (
          <div className="activity-log-stat">
            <span className="activity-log-stat-key">Weight</span>
            <span className="activity-log-stat-val">{log.weight} {log.weightUnit || 'kg'}</span>
          </div>
        )}
        {log.rpe != null && (
          <div className="activity-log-stat">
            <span className="activity-log-stat-key">RPE</span>
            <span className="activity-log-stat-val">
              {log.rpe}/10
              {rpeLabel(log.rpe) && (
                <span className="activity-log-rpe-label"> ({rpeLabel(log.rpe)})</span>
              )}
            </span>
          </div>
        )}
        {log.duration && (
          <div className="activity-log-stat">
            <span className="activity-log-stat-key">Duration</span>
            <span className="activity-log-stat-val">{log.duration}</span>
          </div>
        )}
      </div>

      {log.notes && (
        <p className="activity-log-notes">{log.notes}</p>
      )}

      <div className="activity-log-entry-footer">
        <span className="activity-log-entry-time">{timeAgo(log.completedAt || log.createdAt)}</span>
        <div className="activity-log-entry-actions">
          {isConfirming ? (
            <>
              <button
                className="activity-log-delete-confirm"
                onClick={() => onDelete(log.id)}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button
                className="activity-log-delete-cancel"
                onClick={onCancelDelete}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="activity-log-delete-btn"
              onClick={() => onDelete(log.id)}
              title="Delete entry"
            >
              &times;
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
