import axios from 'axios';

// Configurable so the same build works in dev and production (set VITE_API_URL at build time).
export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

// Resolve any stored image value into a browser-loadable URL.
// Handles every shape we actually store:
//   "https://…" / "http://…"  → external link, use as-is
//   "data:image/…"           → inline preview, use as-is
//   "/uploads/…"             → server-stored upload, prefix with API origin
//   "uploads/…"              → same, tolerate a missing leading slash
//   "" / null / undefined    → null so callers can show a placeholder
//   anything else (e.g. a bare filename) → assume it lives under /uploads/
export const imageUrl = (u) => {
  if (!u || typeof u !== 'string') return null;
  const s = u.trim();
  if (!s) return null;
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:')) return s;
  const path = s.replace(/^\/+/, '');
  if (path.startsWith('uploads/')) return `${API_BASE}/${path}`;
  return `${API_BASE}/uploads/${path}`;
};

const API = axios.create({ baseURL: `${API_BASE}/api` });


// token survives page refresh via localStorage; cleared on logout
let token = localStorage.getItem('ok_token') || null;
export const setToken = (t) => {
  token = t;
  if (t) localStorage.setItem('ok_token', t);
  else localStorage.removeItem('ok_token');
};

API.interceptors.request.use((config) => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → session expired/invalid: clear stored session so the UI shows logged-out state.
// Only auto-clears when a token was actually attached (so a wrong password on the login page doesn't wipe anything).
API.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && err.config?.headers?.Authorization) {
      setToken(null);
      if (localStorage.getItem('ok_user')) {
        localStorage.removeItem('ok_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default API;
