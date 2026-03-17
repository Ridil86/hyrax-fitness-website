import { useState } from 'react';
import './portal-settings.css';

export default function PortalSettings() {
  const [prefs, setPrefs] = useState({
    workoutUpdates: true,
    promotionalEmails: false,
    accountAlerts: true,
  });

  const toggle = (key) => () => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1>Settings</h1>
        <p>Manage your account preferences</p>
      </div>

      <div className="portal-settings-card">
        <h3>Notification Preferences</h3>
        <p className="portal-settings-note">
          These preferences will take effect once our notification system is live.
        </p>

        <div className="portal-settings-toggles">
          <label className="portal-toggle">
            <div className="portal-toggle-info">
              <strong>Workout Updates</strong>
              <span>Get notified when new workouts are added to the library</span>
            </div>
            <div className="portal-toggle-switch">
              <input
                type="checkbox"
                checked={prefs.workoutUpdates}
                onChange={toggle('workoutUpdates')}
              />
              <span className="portal-toggle-slider" />
            </div>
          </label>

          <label className="portal-toggle">
            <div className="portal-toggle-info">
              <strong>Promotional Emails</strong>
              <span>Receive updates about events, promotions, and offers</span>
            </div>
            <div className="portal-toggle-switch">
              <input
                type="checkbox"
                checked={prefs.promotionalEmails}
                onChange={toggle('promotionalEmails')}
              />
              <span className="portal-toggle-slider" />
            </div>
          </label>

          <label className="portal-toggle">
            <div className="portal-toggle-info">
              <strong>Account Alerts</strong>
              <span>Important notifications about your account and billing</span>
            </div>
            <div className="portal-toggle-switch">
              <input
                type="checkbox"
                checked={prefs.accountAlerts}
                onChange={toggle('accountAlerts')}
              />
              <span className="portal-toggle-slider" />
            </div>
          </label>
        </div>
      </div>

      <div className="portal-settings-card">
        <h3>Account</h3>
        <p className="portal-settings-coming">
          Additional account settings — password change, linked accounts, and data export — coming soon.
        </p>
      </div>
    </div>
  );
}
