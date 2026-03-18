import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: '\u2302' },       // house
  { to: '/admin/users', label: 'Users', icon: '\u263A' },     // smiley
  { to: '/admin/content', label: 'Content', icon: '\u270E' }, // pencil
  { to: '/admin/faq', label: 'FAQ', icon: '?' },
  { to: '/admin/workouts', label: 'Workouts', icon: '\u270A' },
  { to: '/admin/videos', label: 'Videos', icon: '\u25B6' },
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
