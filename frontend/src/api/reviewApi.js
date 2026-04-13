import api from './axiosInstance';
export const createReview = (data) => api.post('/reviews', data);
export const getHotelReviews = (hotelId, params) => api.get(`/reviews/hotel/${hotelId}`, { params });
export const updateReview = (id, data) => api.put(`/reviews/${id}`, data);
export const deleteReview = (id) => api.delete(`/reviews/${id}`);
export const toggleHelpful = (id) => api.post(`/reviews/${id}/helpful`);
export const respondToReview = (id, data) => api.post(`/reviews/${id}/respond`, data);
