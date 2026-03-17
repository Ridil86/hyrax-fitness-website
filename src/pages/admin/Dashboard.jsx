import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchUsers } from '../../api/users';
import { fetchFaqs } from '../../api/faq';
import './admin.css';
import './dashboard.css';

export default function Dashboard() {
  const { getIdToken } = useAuth();
  const [stats, setStats] = useState({ users: null, faq: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const token = await getIdToken();
        const [usersResult, faqResult] = await Promise.allSettled([
          fetchUsers({ limit: 1 }, token),
          fetchFaqs(),
        ]);

        if (cancelled) return;

        const userCount = usersResult.status === 'fulfilled'
          ? (usersResult.value.users || []).length + (usersResult.value.nextToken ? '+' : '')
          : null;

        const faqCount = faqResult.status === 'fulfilled'
          ? (faqResult.value || []).length
          : null;

        setStats({ users: userCount, faq: faqCount });
      } catch {
        // Stats load is best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStats();
    return () => { cancelled = true; };
  }, [getIdToken]);

  // For a more accurate user count, we load the full first page
  useEffect(() => {
    let cancelled = false;

    async function loadFullUserCount() {
      try {
        const token = await getIdToken();
        const result = await fetchUsers({ limit: 60 }, token);
        if (cancelled) return;
        const count = (result.users || []).length;
        const display = result.nextToken ? `${count}+` : String(count);
        setStats(prev => ({ ...prev, users: display }));
      } catch {
        // best-effort
      }
    }

    loadFullUserCount();
    return () => { cancelled = true; };
  }, [getIdToken]);

  return (
    <div>
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Hyrax Fitness admin overview</p>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">
            {loading ? <span className="stat-loading" /> : (stats.users ?? '--')}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Programs</div>
          <div className="stat-value">3</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">FAQ Items</div>
          <div className="stat-value">
            {loading ? <span className="stat-loading" /> : (stats.faq ?? '--')}
          </div>
        </div>
      </div>

      <div className="dashboard-links">
        <h3>Quick Links</h3>
        <div className="dashboard-link-grid">
          <Link to="/admin/users" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#128101;</span>
            <div>
              <strong>User Management</strong>
              <p>View and manage user accounts and group memberships</p>
            </div>
          </Link>
          <Link to="/admin/faq" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#10067;</span>
            <div>
              <strong>FAQ Manager</strong>
              <p>Create, edit, and reorder frequently asked questions</p>
            </div>
          </Link>
          <Link to="/admin/content" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#9998;</span>
            <div>
              <strong>Content CMS</strong>
              <p>Edit site content, text, and images for all sections</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
