import './admin.css';

export default function Dashboard() {
  return (
    <div>
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <p>Hyrax Fitness admin overview</p>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">--</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Active Clients</div>
          <div className="stat-value">--</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">Programs</div>
          <div className="stat-value">3</div>
        </div>
        <div className="admin-stat-card">
          <div className="stat-label">FAQ Items</div>
          <div className="stat-value">10</div>
        </div>
      </div>

      <div className="admin-placeholder">
        <div className="admin-placeholder-icon">&#9881;</div>
        <h3>Dashboard Under Construction</h3>
        <p>
          Live stats, user activity, and quick actions will appear here in Phase 2.
        </p>
      </div>
    </div>
  );
}
