import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  googleLogin: async (userData) => {
    const res = await api.post('/auth/google', userData);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

export const emailAPI = {
  schedule: async (emailData) => {
    const res = await api.post('/emails/schedule', emailData);
    return res.data;
  },
  batch: async (batchData) => {
    const res = await api.post('/emails/batch', batchData);
    return res.data;
  },
  uploadLeads: async (fileOrText) => {
    if (fileOrText instanceof File) {
      const formData = new FormData();
      formData.append('file', fileOrText);
      const res = await api.post('/emails/upload-leads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    } else {
      const res = await api.post('/emails/upload-leads', { text: fileOrText });
      return res.data;
    }
  },
  list: async (params) => {
    const res = await api.get('/emails', { params });
    return res.data;
  },
  search: async (q, status) => {
    const res = await api.get('/emails/search', { params: { q, status } });
    return res.data;
  },
  cancel: async (id) => {
    const res = await api.delete(`/emails/${id}`);
    return res.data;
  },
  testLoad: async (data) => {
    const res = await api.post('/emails/test-load', data);
    return res.data;
  },
};

export const statsAPI = {
  get: async () => {
    const res = await api.get('/stats');
    return res.data;
  },
};

export const slackAPI = {
  getStatus: async () => {
    const res = await api.get('/slack/status');
    return res.data;
  },
  connect: async (webhookUrl, channel) => {
    const res = await api.post('/slack/connect', { webhookUrl, channel });
    return res.data;
  },
  test: async (webhookUrl) => {
    const res = await api.post('/slack/test', { webhookUrl });
    return res.data;
  },
  disconnect: async () => {
    const res = await api.post('/slack/disconnect');
    return res.data;
  },
};

export default api;
