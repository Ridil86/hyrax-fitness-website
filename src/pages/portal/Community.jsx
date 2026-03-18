import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchThreads } from '../../api/community';
import './community.css';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '\u25A4' },
  { id: 'general', label: 'General', icon: '\uD83D\uDCAC' },
  { id: 'workouts', label: 'Workouts', icon: '\u270A' },
  { id: 'exercises', label: 'Exercises', icon: '\uD83C\uDFCB\uFE0F' },
  { id: 'events', label: 'Events', icon: '\uD83D\uDCC5' },
  { id: 'progress', label: 'Progress', icon: '\uD83D\uDCC8' },
  { id: 'tips', label: 'Tips & Mods', icon: '\uD83D\uDCA1' },
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

export default function Community() {
  const { getIdToken } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getIdToken();
      const params = {};
      if (category !== 'all') params.category = category;
      if (searchDebounced.trim()) params.search = searchDebounced.trim();
      const data = await fetchThreads(params, token);
      setThreads(Array.isArray(data) ? data : data?.threads || []);
    } catch (err) {
      console.error('Failed to load threads:', err);
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [getIdToken, category, searchDebounced]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // Sort: pinned first, then by date
  const sorted = useMemo(() => {
    return [...threads].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [threads]);

  const categoryLabel = (catId) => {
    const cat = CATEGORIES.find((c) => c.id === catId);
    return cat ? `${cat.icon} ${cat.label}` : catId;
  };

  return (
    <div className="community">
      <div className="community-header">
        <h1>Community</h1>
        <Link to="/portal/community/new" className="btn primary">
          New Thread
        </Link>
      </div>

      <div className="community-filters">
        <div className="community-categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`community-cat-btn${category === cat.id ? ' active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              <span className="community-cat-icon">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        <div className="community-search">
          <input
            type="text"
            placeholder="Search threads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="community-loading">
          <div className="section-spinner" />
          <p>Loading threads...</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="community-empty">
          <span className="community-empty-icon">{'\u25A4'}</span>
          <h3>
            {search || category !== 'all'
              ? 'No matching threads'
              : 'No threads yet'}
          </h3>
          <p>
            {search || category !== 'all'
              ? 'Try adjusting your filters or search.'
              : 'Be the first to start a conversation!'}
          </p>
          {!search && category === 'all' && (
            <Link to="/portal/community/new" className="btn primary" style={{ marginTop: 16 }}>
              Start a Thread
            </Link>
          )}
        </div>
      ) : (
        <div className="community-thread-list">
          {sorted.map((thread) => (
            <Link
              key={thread.id}
              to={`/portal/community/${thread.id}`}
              className="community-thread-card-link"
            >
              <article className="community-thread-card">
                <div className="community-thread-card-body">
                  <div className="community-thread-card-top">
                    {thread.pinned && (
                      <span className="community-pinned" title="Pinned">
                        {'\uD83D\uDCCC'}
                      </span>
                    )}
                    <h3 className="community-thread-title">{thread.title}</h3>
                  </div>

                  {thread.content && (
                    <p className="community-thread-preview">
                      {thread.content.slice(0, 120)}
                      {thread.content.length > 120 ? '...' : ''}
                    </p>
                  )}

                  <div className="community-thread-meta">
                    <div className="community-thread-author">
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
                    </div>

                    <div className="community-thread-stats">
                      <span className="community-thread-category-badge">
                        {categoryLabel(thread.category)}
                      </span>
                      <span className="community-thread-replies">
                        {'\uD83D\uDCAC'} {thread.replyCount || 0}
                      </span>
                      <span className="community-thread-time">
                        {timeAgo(thread.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
