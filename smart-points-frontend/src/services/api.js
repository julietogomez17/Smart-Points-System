
import axios from 'axios';

const api = axios.create({
  baseURL:
    process.env.NODE_ENV === 'production'
      ? 'https://smart-points-system-backend.onrender.com/api'
      : process.env.REACT_APP_API_URL ||
        'http://localhost:5000/api',

  timeout: 30000
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
