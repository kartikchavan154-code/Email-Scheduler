import axios from 'axios';

// In production (Vercel) VITE_API_URL is the Render backend URL.
// In dev the Vite proxy forwards /api → localhost:5000.
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : (import.meta.env.PROD ? 'https://email-scheduler-f59i.onrender.com/api' : '/api');

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for handling 401 unauthenticated
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (!window.location.pathname.startsWith('/login')) {
        // Clear state or redirect
      }
    }
    return Promise.reject(error);
  }
);
