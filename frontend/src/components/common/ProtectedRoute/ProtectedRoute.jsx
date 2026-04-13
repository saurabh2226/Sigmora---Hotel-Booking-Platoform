import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { normalizeRole } from '../../../utils/constants';

export default function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.map((role) => normalizeRole(role)).includes(normalizeRole(user?.role))) {
    return <Navigate to="/" replace />;
  }

  return children;
}
