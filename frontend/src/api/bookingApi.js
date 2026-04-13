import api from './axiosInstance';
export const createBooking = (data) => api.post('/bookings', data);
export const getMyBookings = (params) => api.get('/bookings/my-bookings', { params });
export const getBooking = (id) => api.get(`/bookings/${id}`);
export const cancelBooking = (id, data) => api.put(`/bookings/${id}/cancel`, data);
export const getAllBookings = (params) => api.get('/bookings', { params });
export const updateBookingStatus = (id, data) => api.put(`/bookings/${id}/status`, data);
