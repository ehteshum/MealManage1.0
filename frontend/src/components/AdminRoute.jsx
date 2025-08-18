// Admin gate: only email ishmam@manager.com can access admin routes
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 dark:border-gray-700 border-t-gray-600 dark:border-t-gray-300" />
      </div>
    );
  }

  const isAdmin = (user?.email || '').toLowerCase() === 'ishmam@manager.com';
  if (!isAdmin) {
    return <Navigate to="/" replace state={{ from: location, reason: 'forbidden' }} />;
  }

  return children;
}
