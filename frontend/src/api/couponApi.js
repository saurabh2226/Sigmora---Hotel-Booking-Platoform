import api from './axiosInstance';

export const getPublicOffers = (params) => api.get('/coupons/offers', { params });
export const getManagedCoupons = () => api.get('/coupons/manage');
export const createManagedCoupon = (data) => api.post('/coupons/manage', data);
export const updateManagedCoupon = (id, data) => api.put(`/coupons/manage/${id}`, data);
export const deleteManagedCoupon = (id) => api.delete(`/coupons/manage/${id}`);
