import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';

/* Pre-load CSS for lazy-loaded admin pages to prevent FOUC race condition */
import '../pages/admin/video-admin.css';
import '../pages/admin/equipment-admin.css';
import '../pages/admin/exercise-admin.css';
import '../pages/admin/workout-admin.css';
import '../pages/admin/community-admin.css';
import '../pages/admin/support-admin.css';
import '../pages/admin/analytics.css';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: '\u2302' },       // house
  { to: '/admin/users', label: 'Users', icon: '\u263A' },     // smiley
{ to: '/admin/faq', label: 'FAQ', icon: '?' },
  { to: '/admin/equipment', label: 'Equipment', icon: '\u2692' },
  { to: '/admin/exercises', label: 'Exercises', icon: '\u26A1' },
  { to: '/admin/workouts', label: 'Workouts', icon: '\u270A' },
  { to: '/admin/videos', label: 'Videos', icon: '\u25B6' },
  { to: '/admin/community', label: 'Community', icon: '\u2709' },
  { to: '/admin/support', label: 'Support', icon: '\u2753' },
  { to: '/admin/analytics', label: 'Analytics', icon: '\u{1F4CA}' },
  { to: '/admin/routine-debug', label: 'AI Debug', icon: '\u{1F916}' },
  { to: '/admin/billing', label: 'Billing', icon: '$' },
  { to: '/admin/tiers', label: 'Tiers', icon: '\u2261' },
  { to: '/admin/merch', label: 'Merch', icon: '\u2605' },      // star
  { to: '/admin/audit', label: 'Audit Log', icon: '\u2691' },  // flag
];

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <strong>Admin Panel</strong>
          {user && <span className="admin-sidebar-user">{user.signInDetails?.loginId || 'Admin'}</span>}
        </div>

        <nav className="admin-sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button className="admin-signout" onClick={handleSignOut}>
          Sign Out
        </button>
      </aside>

      <div className="admin-main">
        <Outlet />
      </div>
    </div>
  );
}
