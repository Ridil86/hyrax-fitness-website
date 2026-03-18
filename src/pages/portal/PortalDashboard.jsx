import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTiers } from '../../hooks/useTiers';
import { fetchProfile } from '../../api/profile';
import './portal-dashboard.css';

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

export default function PortalDashboard() {
  const { user, getIdToken } = useAuth();
  const { tiers } = useTiers();
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

  // Check for pending upgrade from /programs page
  useEffect(() => {
    if (!loading && profile) {
      try {
        const pendingTier = localStorage.getItem('pendingUpgradeTier');
        if (pendingTier) {
          localStorage.removeItem('pendingUpgradeTier');
          navigate(`/portal/subscription?upgradeTier=${pendingTier}`, { replace: true });
        }
      } catch { /* ignore localStorage errors */ }
    }
  }, [loading, profile, navigate]);

  // Get display name from profile or user object
  const givenName = profile?.givenName || user?.signInDetails?.loginId?.split('@')[0] || '';
  const familyName = profile?.familyName || '';
  const fullName = [givenName, familyName].filter(Boolean).join(' ') || 'Member';
  const initial = (givenName || fullName || '?')[0].toUpperCase();
  const email = profile?.email || user?.signInDetails?.loginId || '';
  const tier = profile?.tier || 'Pup';
  const memberSince = profile?.createdAt;

  // Find current tier data for logo and level
  const currentTierData = tiers.find((t) => t.name === tier);
  const maxTierLevel = tiers.length > 0 ? Math.max(...tiers.map((t) => t.level || 0)) : 3;
  const isMaxTier = currentTierData?.level >= maxTierLevel;

  if (loading) {
    return (
      <div>
        <div className="portal-header">
          <h1>Dashboard</h1>
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
    <div>
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
          {/* Tier Logo Column */}
          <div className="portal-tier-logo-col">
            {currentTierData?.logoUrl && (
              <img
                src={currentTierData.logoUrl}
                alt={`${tier} logo`}
                className="portal-tier-logo"
              />
            )}
            {!isMaxTier && (
              <Link to="/portal/subscription" className="btn primary small portal-upgrade-btn">
                Upgrade
              </Link>
            )}
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
          <Link to="/portal/workouts" className="portal-link">
            <span className="portal-link-icon">&#128170;</span>
            Workout Library
          </Link>
          <Link to="/portal/profile" className="portal-link">
            <span className="portal-link-icon">&#128100;</span>
            Edit Profile
          </Link>
          <Link to="/portal/subscription" className="portal-link">
            <span className="portal-link-icon">&#11088;</span>
            Manage Subscription
          </Link>
          <Link to="/portal/settings" className="portal-link">
            <span className="portal-link-icon">&#9881;</span>
            Settings
          </Link>
          <Link to="/faq" className="portal-link">
            <span className="portal-link-icon">&#10067;</span>
            FAQ
          </Link>
        </div>
      </div>
    </div>
  );
}
