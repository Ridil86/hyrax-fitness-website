import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchProfile, updateProfile } from '../../api/profile';
import './portal-profile.css';

export default function PortalProfile() {
  const { getIdToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({
    givenName: '',
    familyName: '',
    email: '',
  });

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
      </form>
    </div>
  );
}
