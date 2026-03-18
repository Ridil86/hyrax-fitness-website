import { useState, useEffect } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchUsers, fetchUserGroups, updateUserGroups, deleteUser, freezeUser } from '../../api/users';
import './admin.css';
import './users-admin.css';
import './user-profile.css';

export default function UserProfile() {
  const { username } = useParams();
  const { state } = useLocation();
  const { getIdToken } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState(state?.user || null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(!state?.user);
  const [error, setError] = useState(null);
  const [savingGroups, setSavingGroups] = useState(false);
  const [groupError, setGroupError] = useState(null);
  const [freezing, setFreezing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState(null);

  const decodedUsername = decodeURIComponent(username);

  // Load user data if not passed via route state
  useEffect(() => {
    if (user) return;

    let cancelled = false;

    async function loadUser() {
      try {
        setLoading(true);
        setError(null);
        const token = await getIdToken();
        const result = await fetchUsers({ limit: 60 }, token);
        const found = (result.users || []).find(u => u.username === decodedUsername);
        if (!cancelled) {
          if (found) {
            setUser(found);
          } else {
            setError('User not found');
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load user');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUser();
    return () => { cancelled = true; };
  }, [decodedUsername, getIdToken, user]);

  // Load groups (always fetch fresh)
  useEffect(() => {
    let cancelled = false;

    async function loadGroups() {
      try {
        const token = await getIdToken();
        const result = await fetchUserGroups(decodedUsername, token);
        if (!cancelled) {
          setGroups((result.groups || []).map(g => typeof g === 'string' ? g : g.name));
        }
      } catch {
        // If user was passed via state with groups, use those as fallback
        if (!cancelled && user?.groups) {
          setGroups(user.groups);
        }
      }
    }

    loadGroups();
    return () => { cancelled = true; };
  }, [decodedUsername, getIdToken, user]);

  const handleFreeze = async () => {
    setFreezing(true);
    setActionError(null);
    try {
      const token = await getIdToken();
      const newEnabled = !user.enabled;
      await freezeUser(decodedUsername, newEnabled, token);
      setUser(prev => ({ ...prev, enabled: newEnabled }));
    } catch (err) {
      setActionError(err.message || 'Failed to update user status');
    } finally {
      setFreezing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setActionError(null);
    try {
      const token = await getIdToken();
      await deleteUser(decodedUsername, token);
      navigate('/admin/users');
    } catch (err) {
      setActionError(err.message || 'Failed to delete user');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleToggleGroup = async (group) => {
    setSavingGroups(true);
    setGroupError(null);
    try {
      const newGroups = groups.includes(group)
        ? groups.filter(g => g !== group)
        : [...groups, group];
      const token = await getIdToken();
      await updateUserGroups(decodedUsername, newGroups, token);
      setGroups(newGroups);
    } catch (err) {
      setGroupError(err.message || 'Failed to update groups');
    } finally {
      setSavingGroups(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div>
        <div className="admin-page-header">
          <Link to="/admin/users" className="profile-back">&larr; Back to Users</Link>
          <h1>User Profile</h1>
        </div>
        <div className="profile-skeleton">
          <div className="profile-skeleton-block" />
          <div className="profile-skeleton-block short" />
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div>
        <div className="admin-page-header">
          <Link to="/admin/users" className="profile-back">&larr; Back to Users</Link>
          <h1>User Profile</h1>
        </div>
        <div className="profile-error">
          <p>{error || 'User not found'}</p>
          <Link to="/admin/users" className="btn primary">Back to Users</Link>
        </div>
      </div>
    );
  }

  const userType = groups.includes('Admin') ? 'Admin' : 'Client';
  const fullName = [user.givenName, user.familyName].filter(Boolean).join(' ') || 'Unnamed User';
  const initial = (user.givenName || user.email || '?')[0].toUpperCase();

  return (
    <div>
      <div className="admin-page-header">
        <Link to="/admin/users" className="profile-back">&larr; Back to Users</Link>
        <h1>User Profile</h1>
      </div>

      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">{initial}</div>
          <div className="profile-identity">
            <h2>{fullName}</h2>
            <span className="profile-email">{user.email}</span>
            <span className={`users-type type-${userType.toLowerCase()}`}>{userType}</span>
          </div>
        </div>

        <div className="profile-details">
          <div className="profile-field">
            <label>Username (Cognito Sub)</label>
            <span>{user.username}</span>
          </div>
          <div className="profile-field">
            <label>Email</label>
            <span>{user.email}</span>
          </div>
          <div className="profile-field">
            <label>First Name</label>
            <span>{user.givenName || '--'}</span>
          </div>
          <div className="profile-field">
            <label>Last Name</label>
            <span>{user.familyName || '--'}</span>
          </div>
          <div className="profile-field">
            <label>Status</label>
            <span className={`users-status ${
              user.status === 'CONFIRMED' ? 'confirmed' :
              user.status === 'FORCE_CHANGE_PASSWORD' ? 'pending' : ''
            }`}>{user.status || '--'}</span>
          </div>
          <div className="profile-field">
            <label>Enabled</label>
            <span>{user.enabled !== undefined ? (user.enabled ? 'Yes' : 'No') : '--'}</span>
          </div>
          <div className="profile-field">
            <label>Created</label>
            <span>{formatDate(user.createdAt)}</span>
          </div>
          <div className="profile-field">
            <label>Last Modified</label>
            <span>{formatDate(user.lastModified)}</span>
          </div>
        </div>

        <div className="profile-groups-section">
          <h3>Group Membership</h3>
          <div className="users-groups">
            {['Admin', 'Client'].map(group => (
              <label key={group} className="users-group-toggle">
                <input
                  type="checkbox"
                  checked={groups.includes(group)}
                  onChange={() => handleToggleGroup(group)}
                  disabled={savingGroups}
                />
                <span>{group}</span>
              </label>
            ))}
            {savingGroups && <span className="users-saving">Saving...</span>}
          </div>
          {groupError && <div className="users-group-error">{groupError}</div>}
        </div>

        <div className="profile-status-section">
          <h3>Account Status</h3>
          <div className="profile-status-row">
            <span className={`profile-status-badge ${user.enabled ? 'enabled' : 'disabled'}`}>
              {user.enabled ? 'Active' : 'Frozen'}
            </span>
            <button
              className={`profile-freeze-btn ${user.enabled ? 'freeze' : 'unfreeze'}`}
              onClick={handleFreeze}
              disabled={freezing}
            >
              {freezing ? 'Updating...' : user.enabled ? 'Freeze Account' : 'Unfreeze Account'}
            </button>
          </div>
          <p className="muted small" style={{ marginTop: 6 }}>
            {user.enabled
              ? 'Freezing prevents this user from signing in.'
              : 'This account is frozen. The user cannot sign in until unfrozen.'}
          </p>
        </div>

        {actionError && <div className="profile-action-error">{actionError}</div>}

        <div className="profile-danger-zone">
          <h3>Danger Zone</h3>
          <p className="muted small">Permanently delete this user from Cognito and remove their profile data. This action cannot be undone.</p>
          <button
            className="profile-delete-btn"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
          >
            Delete User
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="profile-confirm-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="profile-confirm-dialog" onClick={e => e.stopPropagation()}>
            <h3>Delete User</h3>
            <p>Are you sure you want to permanently delete <strong>{fullName}</strong> ({user.email})? This will remove their Cognito account and all profile data.</p>
            <div className="profile-confirm-actions">
              <button className="btn" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
              <button className="profile-delete-btn" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
