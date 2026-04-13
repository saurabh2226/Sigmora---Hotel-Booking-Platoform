import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const AUTH_REFRESH_EXCLUDED_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/logout',
  '/auth/refresh-token',
  '/auth/forgot-password',
  '/auth/resend-otp',
  '/auth/verify-email-otp',
  '/auth/verify-reset-password-otp',
  '/auth/reset-password',
  '/auth/reset-password-session',
  '/auth/google',
];

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const shouldAttemptTokenRefresh = (error) => {
  const originalRequest = error.config;
  const requestUrl = originalRequest?.url || '';

  if (!error.response || error.response.status !== 401 || !originalRequest || originalRequest._retry) {
    return false;
  }

  if (AUTH_REFRESH_EXCLUDED_PATHS.some((path) => requestUrl.includes(path))) {
    return false;
  }

  return !!localStorage.getItem('accessToken');
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (shouldAttemptTokenRefresh(error)) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh-token`, {}, { withCredentials: true });
        localStorage.setItem('accessToken', data.data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');

        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
