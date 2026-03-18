import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchUsers } from '../../api/users';
import { fetchFaqs } from '../../api/faq';
import { fetchWorkouts } from '../../api/workouts';
import { fetchVideos } from '../../api/videos';
import { fetchCommunityStats } from '../../api/community';
import './admin.css';
import './dashboard.css';

export default function Dashboard() {
  const { getIdToken } = useAuth();
  const [stats, setStats] = useState({ users: null, faq: null, workouts: null, videos: null, threads: null, pendingReports: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      try {
        const token = await getIdToken();
        const [usersResult, faqResult, workoutsResult, videosResult, communityResult] = await Promise.allSettled([
          fetchUsers({ limit: 60 }, token),
          fetchFaqs(),
          fetchWorkouts(token),
          fetchVideos(token),
          fetchCommunityStats(token),
        ]);

        if (cancelled) return;

        const userCount = usersResult.status === 'fulfilled'
          ? (() => {
              const count = (usersResult.value.users || []).length;
              return usersResult.value.nextToken ? `${count}+` : String(count);
            })()
          : null;

        const faqCount = faqResult.status === 'fulfilled'
          ? (faqResult.value || []).length
          : null;

        const workoutCount = workoutsResult.status === 'fulfilled'
          ? (workoutsResult.value || []).length
          : null;

        const videoCount = videosResult.status === 'fulfilled'
          ? (videosResult.value || []).length
          : null;

        const threadCount = communityResult.status === 'fulfilled'
          ? communityResult.value.totalThreads
          : null;

        const pendingReports = communityResult.status === 'fulfilled'
          ? communityResult.value.pendingReports
          : null;

        setStats({ users: userCount, faq: faqCount, workouts: workoutCount, videos: videoCount, threads: threadCount, pendingReports });
      } catch {
        // Stats load is best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStats();
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
        <div className="admin-stat-card">
          <div className="stat-label">Workouts</div>
          <div className="stat-value">
            {loading ? <span className="stat-loading" /> : (stats.workouts ?? '--')}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Videos</div>
          <div className="stat-value">
            {loading ? <span className="stat-loading" /> : (stats.videos ?? '--')}
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Threads</div>
          <div className="stat-value">
            {loading ? <span className="stat-loading" /> : (stats.threads ?? '--')}
          </div>
        </div>
        {stats.pendingReports > 0 && (
          <div className="admin-stat-card">
            <div className="stat-label">Pending Reports</div>
            <div className="stat-value" style={{ color: '#dc2626' }}>
              {stats.pendingReports}
            </div>
          </div>
        )}
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
          <Link to="/admin/workouts" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#128170;</span>
            <div>
              <strong>Workout Library</strong>
              <p>Create and manage workout regimens for the content library</p>
            </div>
          </Link>
          <Link to="/admin/videos" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#9654;</span>
            <div>
              <strong>Video Library</strong>
              <p>Upload and manage video content for members</p>
            </div>
          </Link>
          <Link to="/admin/audit" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#9873;</span>
            <div>
              <strong>Audit Log</strong>
              <p>View compliance events and cookie consent tracking</p>
            </div>
          </Link>
          <Link to="/admin/billing" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#128176;</span>
            <div>
              <strong>Billing</strong>
              <p>View subscriptions, payments, and revenue analytics</p>
            </div>
          </Link>
          <Link to="/admin/tiers" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#127941;</span>
            <div>
              <strong>Tier Management</strong>
              <p>Edit subscription tier names, pricing, and features</p>
            </div>
          </Link>
          <Link to="/admin/community" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#9993;</span>
            <div>
              <strong>Community</strong>
              <p>Moderate threads, manage reports, and pin announcements</p>
            </div>
          </Link>
          <Link to="/admin/merch" className="dashboard-link-card">
            <span className="dashboard-link-icon">&#11088;</span>
            <div>
              <strong>Merchandise</strong>
              <p>Manage merchandise and product listings</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
