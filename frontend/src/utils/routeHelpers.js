import { normalizeRole } from './constants';

export const getDashboardPathForRole = (role) => {
  if (normalizeRole(role) === 'admin') {
    return '/admin';
  }

  return '/dashboard';
};

const isGuestOnlyPath = (path) => ['/login', '/register'].includes(path);

export const getPostAuthRedirect = (user, preferredPath = '/dashboard') => {
  const dashboardPath = getDashboardPathForRole(user?.role);

  if (dashboardPath !== '/dashboard') {
    return dashboardPath;
  }

  if (typeof preferredPath === 'string' && preferredPath.startsWith('/') && !isGuestOnlyPath(preferredPath)) {
    return preferredPath;
  }

  return '/dashboard';
};
