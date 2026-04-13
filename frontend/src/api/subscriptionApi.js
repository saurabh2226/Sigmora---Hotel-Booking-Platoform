import api from './axiosInstance';

export const subscribeNewsletter = (data) => api.post('/subscriptions/newsletter', data);
