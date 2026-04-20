import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchUsers } from '../../api/users';
import './admin.css';
import './users-admin.css';

const PAGE_SIZE = 20;

export default function Users() {
  const { getIdToken } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [filterInput, setFilterInput] = useState('');
  const [paginationToken, setPaginationToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const loadUsers = useCallback(async (append = false) => {
    try {
      setError(null);
      if (!append) setLoading(true);
      const token = await getIdToken();
      const result = await fetchUsers(
        { limit: PAGE_SIZE, paginationToken: append ? paginationToken : undefined, filter: filter || undefined },
        token
      );
      if (append) {
        setUsers(prev => [...prev, ...(result.users || [])]);
      } else {
        setUsers(result.users || []);
      }
      setPaginationToken(result.nextToken || null);
      setHasMore(!!result.nextToken);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, paginationToken, filter]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPaginationToken(null);
    setFilter(filterInput.trim());
  };

  const handleClearFilter = () => {
    setFilterInput('');
    setPaginationToken(null);
    setFilter('');
  };

  const handleRowClick = (user) => {
    navigate(`/admin/users/${encodeURIComponent(user.username)}`, { state: { user } });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Users</h1>
        <p>Manage client accounts and group memberships</p>
      </div>

      {/* Search */}
      <form className="users-search" onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search by email..."
          value={filterInput}
          onChange={e => setFilterInput(e.target.value)}
          className="users-search-input"
        />
        <button type="submit" className="btn primary users-search-btn">Search</button>
        {filter && (
          <button type="button" className="btn users-clear-btn" onClick={handleClearFilter}>Clear</button>
        )}
      </form>

      {error && (
        <div className="users-error">
          <p>{error}</p>
          <button className="btn primary" onClick={() => loadUsers()}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="users-skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="users-skeleton-row" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="users-empty">
          <p>{filter ? `No users matching "${filter}"` : 'No users found'}</p>
        </div>
      ) : (
        <>
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Type</th>
                  <th>Tier</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const groups = user.groups || [];
                  const userType = groups.includes('Admin') ? 'Admin' : 'Client';
                  const name = [user.givenName, user.familyName].filter(Boolean).join(' ') || '--';

                  return (
                    <UserRow
                      key={user.username}
                      email={user.email || user.username}
                      userType={userType}
                      tier={user.tier || 'Pup'}
                      onTrial={!!user.onTrial}
                      name={name}
                      status={user.status || '--'}
                      created={formatDate(user.createdAt)}
                      onClick={() => handleRowClick(user)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="users-load-more">
              <button className="btn primary" onClick={() => loadUsers(true)}>
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function tierSlug(tier) {
  return (tier || '').toLowerCase().replace(/\s+/g, '-');
}

function UserRow({ email, userType, tier, onTrial, name, status, created, onClick }) {
  const statusClass = status === 'CONFIRMED' ? 'confirmed' : status === 'FORCE_CHANGE_PASSWORD' ? 'pending' : '';
  const typeClass = userType === 'Admin' ? 'type-admin' : 'type-client';
  const tierLabel = onTrial ? 'Trial' : tier;
  const tierClass = onTrial ? 'tier-trial' : `tier-${tierSlug(tier)}`;

  return (
    <tr className="users-row" onClick={onClick}>
      <td className="users-email">{email}</td>
      <td><span className={`users-type ${typeClass}`}>{userType}</span></td>
      <td><span className={`users-tier ${tierClass}`}>{tierLabel}</span></td>
      <td>{name}</td>
      <td><span className={`users-status ${statusClass}`}>{status}</span></td>
      <td>{created}</td>
    </tr>
  );
}
