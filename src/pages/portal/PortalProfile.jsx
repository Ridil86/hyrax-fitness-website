import { useState, useEffect } from 'react';
import { updatePassword } from 'aws-amplify/auth';
import { useAuth } from '../../context/AuthContext';
import { fetchProfile, updateProfile } from '../../api/profile';
import './portal-profile.css';

export default function PortalProfile() {
  const { getIdToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    givenName: '',
    familyName: '',
    email: '',
  });

  // Password change state
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState(null);

  const isGoogleUser = user?.username?.startsWith('Google_') || user?.username?.startsWith('google_');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getIdToken();
        const profile = await fetchProfile(token);
        if (cancelled) return;
        if (profile) {
          setForm({
            givenName: profile.givenName || '',
            familyName: profile.familyName || '',
            email: profile.email || '',
          });
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [getIdToken]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setMessage(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = await getIdToken();
      await updateProfile(token, {
        givenName: form.givenName.trim(),
        familyName: form.familyName.trim(),
      });
      setMessage({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setPwSaving(true);
    setPwMessage(null);
    try {
      await updatePassword({ oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword });
      setPwMessage({ type: 'success', text: 'Password changed successfully.' });
      setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMessage({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="portal-profile-loading">
        <div className="section-spinner" />
        <p>Loading profile...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1>Profile</h1>
        <p>View and update your account information</p>
      </div>

      {message && (
        <div className={`portal-profile-msg ${message.type}`}>
          {message.text}
        </div>
      )}

      <form className="portal-profile-form" onSubmit={handleSave}>
        <div className="portal-profile-card">
          <h3>Personal Information</h3>

          <div className="content-field">
            <label htmlFor="givenName">First Name</label>
            <input
              id="givenName"
              type="text"
              value={form.givenName}
              onChange={handleChange('givenName')}
              placeholder="Enter your first name"
            />
          </div>

          <div className="content-field">
            <label htmlFor="familyName">Last Name</label>
            <input
              id="familyName"
              type="text"
              value={form.familyName}
              onChange={handleChange('familyName')}
              placeholder="Enter your last name"
            />
          </div>

          <div className="content-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              readOnly
              className="portal-profile-readonly"
            />
            <span className="portal-profile-hint">
              Email cannot be changed here.
            </span>
          </div>

          <div className="portal-profile-actions">
            <button
              type="submit"
              className="btn primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* Security — Password Change (non-Google users only) */}
      {!isGoogleUser && (
        <div className="portal-profile-card">
          <h3>Security</h3>

          {pwMessage && (
            <div className={`portal-profile-msg ${pwMessage.type}`}>
              {pwMessage.text}
            </div>
          )}

          <div className="content-field">
            <label htmlFor="oldPassword">Current Password</label>
            <input
              id="oldPassword"
              type="password"
              value={pwForm.oldPassword}
              onChange={(e) => setPwForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
              placeholder="Enter current password"
            />
          </div>

          <div className="content-field">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              placeholder="Enter new password"
            />
          </div>

          <div className="content-field">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Confirm new password"
            />
          </div>

          <div className="portal-profile-actions">
            <button
              type="button"
              className="btn primary"
              onClick={handlePasswordChange}
              disabled={pwSaving}
            >
              {pwSaving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      )}

      {/* Linked Accounts */}
      <div className="portal-profile-card">
        <h3>Linked Accounts</h3>

        {isGoogleUser ? (
          <div className="portal-linked-account">
            <span className="portal-linked-icon">G</span>
            <div>
              <strong>Google</strong>
              <p>{form.email}</p>
            </div>
          </div>
        ) : (
          <p className="portal-linked-none">No linked accounts. You sign in with email and password.</p>
        )}
      </div>
    </div>
  );
}
