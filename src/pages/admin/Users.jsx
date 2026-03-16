import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchUsers, fetchUserGroups, updateUserGroups } from '../../api/users';
import './admin.css';
import './users-admin.css';

const PAGE_SIZE = 20;

export default function Users() {
  const { getIdToken } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [filterInput, setFilterInput] = useState('');
  const [paginationToken, setPaginationToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [userGroups, setUserGroups] = useState({});
  const [savingGroups, setSavingGroups] = useState(null);
  const [groupError, setGroupError] = useState(null);

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
      setPaginationToken(result.paginationToken || null);
      setHasMore(!!result.paginationToken);
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
    setExpandedUser(null);
    setPaginationToken(null);
    setFilter(filterInput.trim());
  };

  const handleClearFilter = () => {
    setFilterInput('');
    setExpandedUser(null);
    setPaginationToken(null);
    setFilter('');
  };

  const toggleExpand = async (username) => {
    if (expandedUser === username) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(username);
    setGroupError(null);

    // Load groups if not cached
    if (!userGroups[username]) {
      try {
        const token = await getIdToken();
        const result = await fetchUserGroups(username, token);
        setUserGroups(prev => ({ ...prev, [username]: result.groups || [] }));
      } catch (err) {
        setGroupError(err.message || 'Failed to load groups');
      }
    }
  };

  const handleToggleGroup = async (username, group) => {
    setSavingGroups(username);
    setGroupError(null);
    try {
      const current = userGroups[username] || [];
      const newGroups = current.includes(group)
        ? current.filter(g => g !== group)
        : [...current, group];

      const token = await getIdToken();
      await updateUserGroups(username, newGroups, token);
      setUserGroups(prev => ({ ...prev, [username]: newGroups }));
    } catch (err) {
      setGroupError(err.message || 'Failed to update groups');
    } finally {
      setSavingGroups(null);
    }
  };

  const getAttr = (user, name) => {
    const attr = (user.Attributes || user.attributes || []).find(
      a => a.Name === name || a.name === name
    );
    return attr ? (attr.Value || attr.value || '') : '';
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
                  <th>Name</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const username = user.Username || user.username;
                  const email = getAttr(user, 'email') || username;
                  const givenName = getAttr(user, 'given_name');
                  const familyName = getAttr(user, 'family_name');
                  const name = [givenName, familyName].filter(Boolean).join(' ') || '--';
                  const status = user.UserStatus || user.userStatus || '--';
                  const created = user.UserCreateDate || user.userCreateDate;
                  const isExpanded = expandedUser === username;
                  const groups = userGroups[username] || [];

                  return (
                    <UserRow
                      key={username}
                      username={username}
                      email={email}
                      name={name}
                      status={status}
                      created={formatDate(created)}
                      isExpanded={isExpanded}
                      groups={groups}
                      savingGroups={savingGroups === username}
                      groupError={isExpanded ? groupError : null}
                      onToggleExpand={() => toggleExpand(username)}
                      onToggleGroup={(group) => handleToggleGroup(username, group)}
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

function UserRow({ username, email, name, status, created, isExpanded, groups, savingGroups, groupError, onToggleExpand, onToggleGroup }) {
  const statusClass = status === 'CONFIRMED' ? 'confirmed' : status === 'FORCE_CHANGE_PASSWORD' ? 'pending' : '';

  return (
    <>
      <tr className={`users-row ${isExpanded ? 'expanded' : ''}`} onClick={onToggleExpand}>
        <td className="users-email">{email}</td>
        <td>{name}</td>
        <td>
          <span className={`users-status ${statusClass}`}>{status}</span>
        </td>
        <td>{created}</td>
      </tr>
      {isExpanded && (
        <tr className="users-detail-row">
          <td colSpan={4}>
            <div className="users-detail">
              <div className="users-detail-section">
                <strong>Username</strong>
                <span className="users-detail-value">{username}</span>
              </div>
              <div className="users-detail-section">
                <strong>Groups</strong>
                <div className="users-groups">
                  {['Admin', 'Client'].map(group => (
                    <label key={group} className="users-group-toggle">
                      <input
                        type="checkbox"
                        checked={groups.includes(group)}
                        onChange={() => onToggleGroup(group)}
                        disabled={savingGroups}
                      />
                      <span>{group}</span>
                    </label>
                  ))}
                  {savingGroups && <span className="users-saving">Saving...</span>}
                </div>
                {groupError && <div className="users-group-error">{groupError}</div>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
