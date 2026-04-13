import api from './axiosInstance';

export const getOwnerDashboard = () => api.get('/admin/dashboard');
export const getOwnerCommunityThreads = (params) => api.get('/admin/community', { params });
export const createOwnerCommunityThread = (data) => api.post('/admin/community', data);
export const replyToOwnerCommunityThread = (id, data) => api.post(`/admin/community/${id}/replies`, data);
export const getOwnerMonthlyReport = (params) => api.get('/admin/reports/monthly', { params });
