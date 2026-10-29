import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

export const authApi = {
  login: (u, p) => api.post('/auth/login', { username: u, password: p }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (current, next) => api.post('/auth/change-password', { current, next }),
};

export const formsApi = {
  list: () => api.get('/forms'),
  get: (id) => api.get(`/forms/${id}`),
  create: (data) => api.post('/forms', data),
  update: (id, data) => api.put(`/forms/${id}`, data),
  remove: (id) => api.delete(`/forms/${id}`),
  questions: (formId) => api.get(`/forms/${formId}/questions`),
  addQuestion: (formId, data) => api.post(`/forms/${formId}/questions`, data),
  updateQuestion: (formId, qid, data) => api.put(`/forms/${formId}/questions/${qid}`, data),
  deleteQuestion: (formId, qid) => api.delete(`/forms/${formId}/questions/${qid}`),
  reorder: (formId, order) => api.post(`/forms/${formId}/questions/reorder`, { order }),
  stats: (id) => api.get(`/forms/${id}/stats`),
  responses: (id, page = 1) => api.get(`/forms/${id}/responses`, { params: { page } }),
  exportCsv: (id) => `/api/forms/${id}/export.csv`,
  purgeResponses: (id) => api.delete(`/forms/${id}/responses`),
};

export const publicApi = {
  getSettings: () => api.get('/public/settings'),
  getForm: (slug) => api.get(`/f/${slug}`),
  submit: (slug, formData) => api.post(`/f/${slug}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};