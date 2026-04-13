import api from './axiosInstance';
export const createRazorpayOrder = (data) => api.post('/payments/create-order', data);
export const verifyRazorpayPayment = (data) => api.post('/payments/verify', data);
export const markRazorpayPaymentFailed = (bookingId, data) => api.post(`/payments/${bookingId}/fail`, data);
export const initiateRefund = (bookingId, data) => api.post(`/payments/${bookingId}/refund`, data);
