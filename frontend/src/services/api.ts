import axios from 'axios';
import { getApiBaseUrl } from '../utils/config';

const API_URL = getApiBaseUrl();

// Only use credentials for cross-origin requests (iOS ITP blocks with credentials on same-origin)
const isSameOrigin = API_URL.startsWith('/') || API_URL.startsWith(window.location.origin);

const api = axios.create({
  baseURL: API_URL,
  withCredentials: !isSameOrigin, // Only for cross-origin (iOS ITP workaround)
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // Bypass ngrok interstitial for API calls
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        
        localStorage.setItem('token', response.data.token);
        originalRequest.headers.Authorization = `Bearer ${response.data.token}`;
        
        return api(originalRequest);
      } catch (err) {
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
