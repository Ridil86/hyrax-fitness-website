import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchProfile } from '../api/profile';
import './portal.css';

function tierClass(tier) {
  if (!tier) return 'pup';
  const t = tier.toLowerCase();
  if (t.includes('iron')) return 'iron-dassie';
  if (t.includes('runner') || t.includes('rock')) return 'rock-runner';
  return 'pup';
}

function formatDate(iso) {
  if (!iso) return '--';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function Portal() {
  const { user, signOut, getIdToken } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const token = await getIdToken();
        if (token) {
          const result = await fetchProfile(token);
          if (!cancelled) setProfile(result);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => { cancelled = true; };
  }, [getIdToken]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Get display name from profile or user object
  const givenName = profile?.givenName || user?.signInDetails?.loginId?.split('@')[0] || '';
  const familyName = profile?.familyName || '';
  const fullName = [givenName, familyName].filter(Boolean).join(' ') || 'Member';
  const initial = (givenName || fullName || '?')[0].toUpperCase();
  const email = profile?.email || user?.signInDetails?.loginId || '';
  const tier = profile?.tier || 'Pup';
  const memberSince = profile?.createdAt;

  if (loading) {
    return (
      <div className="portal-page">
        <div className="portal-header">
          <h1>My Portal</h1>
          <p>Loading your profile...</p>
        </div>
        <div className="portal-skeleton">
          <div className="portal-skeleton-block" />
          <div className="portal-skeleton-block short" />
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <div className="portal-header">
        <h1>Welcome back, {givenName || 'there'}!</h1>
        <p>Your Hyrax Fitness dashboard</p>
      </div>

      {/* Profile Card */}
      <div className="portal-card">
        <div className="portal-profile-header">
          <div className="portal-avatar">{initial}</div>
          <div className="portal-identity">
            <h2>{fullName}</h2>
            <span className="portal-email">{email}</span>
            <div>
              <span className={`portal-tier ${tierClass(tier)}`}>{tier}</span>
            </div>
          </div>
        </div>

        <div className="portal-details">
          <div className="portal-detail-item">
            <label>Member Since</label>
            <span>{formatDate(memberSince)}</span>
          </div>
          <div className="portal-detail-item">
            <label>Current Tier</label>
            <span>{tier}</span>
          </div>
          <div className="portal-detail-item">
            <label>Email</label>
            <span>{email}</span>
          </div>
          <div className="portal-detail-item">
            <label>Name</label>
            <span>{fullName}</span>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="portal-card">
        <h3>Quick Links</h3>
        <div className="portal-links">
          <Link to="/programs" className="portal-link">
            <span className="portal-link-icon">&#9881;</span>
            Explore Programs
          </Link>
          <Link to="/terms" className="portal-link">
            <span className="portal-link-icon">&#128196;</span>
            Terms of Use
          </Link>
          <Link to="/privacy" className="portal-link">
            <span className="portal-link-icon">&#128274;</span>
            Privacy Policy
          </Link>
          <Link to="/faq" className="portal-link">
            <span className="portal-link-icon">&#10067;</span>
            FAQ
          </Link>
        </div>
      </div>

      {/* Sign Out */}
      <div className="portal-signout">
        <button className="btn ghost" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
