import api from './axiosInstance';

export const getSupportConversations = () => api.get('/support/conversations');
export const getSupportConversation = (id) => api.get(`/support/conversations/${id}`);
export const createSupportConversation = (data) => api.post('/support/conversations', data);
export const sendSupportMessage = (id, data) => api.post(`/support/conversations/${id}/messages`, data);
export const updateSupportConversationStatus = (id, data) => api.put(`/support/conversations/${id}/status`, data);
export const askSupportAssistant = (data) => api.post('/support/assistant', data);
