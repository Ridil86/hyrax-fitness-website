import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './PortalLayout.css';

const navItems = [
  { to: '/portal', label: 'Dashboard', icon: '\u2302' },
  { to: '/portal/workouts', label: 'Workouts', icon: '\u270A' },
  { to: '/portal/videos', label: 'Videos', icon: '\u25B6' },
  { to: '/portal/community', label: 'Community', icon: '\u2709' },
  { to: '/portal/support', label: 'Support', icon: '\u2753' },
  { to: '/portal/profile', label: 'Profile', icon: '\u263A' },
  { to: '/portal/subscription', label: 'Subscription', icon: '\u2606' },
  { to: '/portal/settings', label: 'Settings', icon: '\u2699' },
];

export default function PortalLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="portal-layout">
      <aside className="portal-sidebar">
        <div className="portal-sidebar-brand">
          <strong>My Account</strong>
          {user && <span className="portal-sidebar-user">{user.signInDetails?.loginId || 'Member'}</span>}
        </div>

        <nav className="portal-sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/portal'}
              className={({ isActive }) => `portal-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="portal-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
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
