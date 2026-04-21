import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasTierAccess } from '../utils/tiers';
import './PortalLayout.css';

const navItems = [
  { to: '/portal', label: 'Dashboard', icon: '\u2302', requiredTier: null },
  { to: '/portal/routine', label: 'My Routine', icon: '\u{1F4CB}', requiredTier: 'Rock Runner' },
  { to: '/portal/nutrition', label: 'My Nutrition', icon: '\u{1F957}', requiredTier: 'Iron Dassie' },
  { to: '/portal/chat', label: 'Personal Coach', icon: '\u{1F916}', requiredTier: 'Iron Dassie' },
  { to: '/portal/workouts', label: 'Workouts', icon: '\u270A', requiredTier: null },
  { to: '/portal/videos', label: 'Videos', icon: '\u25B6', requiredTier: null },
  { to: '/portal/progress', label: 'Progress', icon: '\u{1F4C8}', requiredTier: null },
  { to: '/portal/benchmarks', label: 'Benchmarks', icon: '\u{1F3C6}', requiredTier: null },
  { to: '/portal/activity', label: 'Activity', icon: '\u{1F4CA}', requiredTier: null },
  { to: '/portal/community', label: 'Community', icon: '\u2709', requiredTier: null },
  { to: '/portal/subscription', label: 'Subscription', icon: '\u2606', requiredTier: null },
  { to: '/portal/profile', label: 'Profile', icon: '\u263A', requiredTier: null },
  { to: '/portal/settings', label: 'Settings', icon: '\u2699', requiredTier: null },
  { to: '/portal/support', label: 'Support', icon: '\u2753', requiredTier: null },
];

export default function PortalLayout() {
  const { user, signOut, effectiveTier, trialActive } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const tierKey = (effectiveTier || 'Pup').toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <div className="portal-sidebar-brand">
          <strong>My Account</strong>
          {user && <span className="portal-sidebar-user">{user.signInDetails?.loginId || 'Member'}</span>}
          <span className={`portal-tier-badge portal-tier-${tierKey}`}>
            {effectiveTier || 'Pup'}{trialActive ? ' · Trial' : ''}
          </span>
        </div>

        <nav className="portal-sidebar-nav">
          {navItems.map((item) => {
            const unlocked = hasTierAccess(effectiveTier, item.requiredTier);
            if (unlocked) {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/portal'}
                  className={({ isActive }) => `portal-nav-link ${isActive ? 'active' : ''}`}
                >
                  <span className="portal-nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              );
            }
            return (
              <NavLink
                key={item.to}
                to="/portal/subscription"
                className="portal-nav-link locked"
                title={`Upgrade to ${item.requiredTier} to unlock`}
              >
                <span className="portal-nav-icon">{item.icon}</span>
                <span className="portal-nav-label">{item.label}</span>
                <span className="portal-nav-lock" aria-label="Locked">&#x1F512;</span>
              </NavLink>
            );
          })}
        </nav>

        <button className="portal-signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </aside>

      <div className="portal-main">
        <Outlet />
      </div>
    </div>
  );
}
