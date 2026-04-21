import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ requiredGroup, children }) {
  const { isAuthenticated, groups, loading, profileMissing } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="section-spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but no DynamoDB profile yet (aborted Google OAuth terms step).
  // Funnel them back through the legal-acceptance step so we can create one.
  if (profileMissing && requiredGroup !== 'Admin') {
    return <Navigate to="/get-started?google=1" replace />;
  }

  if (requiredGroup && !groups.includes(requiredGroup)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
