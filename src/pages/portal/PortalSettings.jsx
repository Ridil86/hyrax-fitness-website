import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiGet, apiPut } from '../../api/client';
import './portal-settings.css';

const DEFAULT_PREFS = {
  subscription: true,
  support: true,
  trial: true,
};

export default function PortalSettings() {
  const { getIdToken } = useAuth();
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const loadPrefs = useCallback(async () => {
    try {
      const token = await getIdToken();
      const profile = await apiGet('/api/profile', token);
      if (profile.notificationPreferences) {
        setPrefs({
          subscription: profile.notificationPreferences.subscription !== false,
          support: profile.notificationPreferences.support !== false,
          trial: profile.notificationPreferences.trial !== false,
        });
      }
    } catch {
      // If profile load fails, keep defaults (all on)
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  const toggle = (key) => async () => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaving(true);
    setSaveMsg(null);

    try {
      const token = await getIdToken();
      await apiPut('/api/profile', { notificationPreferences: newPrefs }, token);
      setSaveMsg({ type: 'success', text: 'Preferences saved' });
    } catch {
      // Revert on failure
      setPrefs(prefs);
      setSaveMsg({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Settings</h1>
        <p>Manage your account preferences</p>
      </div>

      <div className="portal-settings-card">
        <h3>Email Notifications</h3>
        <p className="portal-settings-note">
          Control which email notifications you receive. Authentication emails (verification, password reset) cannot be disabled.
        </p>

        {loading ? (
          <p style={{ color: 'var(--earth)', padding: '12px 0' }}>Loading preferences...</p>
        ) : (
          <div className="portal-settings-toggles">
            <label className="portal-toggle">
              <div className="portal-toggle-info">
                <strong>Subscription & Payments</strong>
                <span>Notifications about plan changes, payment confirmations, and billing issues</span>
              </div>
              <div className="portal-toggle-switch">
                <input
                  type="checkbox"
                  checked={prefs.subscription}
                  onChange={toggle('subscription')}
                  disabled={saving}
                />
                <span className="portal-toggle-slider" />
              </div>
            </label>

            <label className="portal-toggle">
              <div className="portal-toggle-info">
                <strong>Support Tickets</strong>
                <span>Get notified when your support tickets receive a reply</span>
              </div>
              <div className="portal-toggle-switch">
                <input
                  type="checkbox"
                  checked={prefs.support}
                  onChange={toggle('support')}
                  disabled={saving}
                />
                <span className="portal-toggle-slider" />
              </div>
            </label>

            <label className="portal-toggle">
              <div className="portal-toggle-info">
                <strong>Trial Reminders</strong>
                <span>Reminders about your free trial status and expiration</span>
              </div>
              <div className="portal-toggle-switch">
                <input
                  type="checkbox"
                  checked={prefs.trial}
                  onChange={toggle('trial')}
                  disabled={saving}
                />
                <span className="portal-toggle-slider" />
              </div>
            </label>
          </div>
        )}

        {saveMsg && (
          <p className={`portal-settings-save-msg ${saveMsg.type}`}>
            {saveMsg.text}
          </p>
        )}
      </div>
    </div>
  );
}
