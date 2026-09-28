import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import API, { setToken } from '../api';

const AuthContext = createContext(null);

// restore session after page refresh
const stored = (() => {
  try {
    const raw = localStorage.getItem('ok_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(stored);

  const persist = (u) => {
    setUser(u);
    if (u) localStorage.setItem('ok_user', JSON.stringify(u));
    else localStorage.removeItem('ok_user');
  };

  // `opts.scope` is the storefront's shopper-only guard ('customer') or the
  // portal's 'portal' scope; omitted means "this is the business app".
  const login = useCallback(async (api, email, password, opts = {}) => {
    const { data } = await api.post('/auth/login', { email, password, ...opts });
    setToken(data.token);
    persist(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (api, payload) => {
    const { data } = await api.post('/auth/register', payload);
    setToken(data.token);
    persist(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => { setToken(null); persist(null); }, []);

  // merge fresh profile/shop data (e.g. after Profile or Shop Setup edits) into the stored user
  const updateUser = useCallback((patch) => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, ...patch };
      localStorage.setItem('ok_user', JSON.stringify(next));
      return next;
    });
  }, []);

  // The stored user is a snapshot from sign-in, so an approval granted later
  // (a rider or shop going from `pending` to working) would not be visible
  // until the user logged out and back in. Re-reading the profile on mount keeps
  // the session honest without asking anyone to sign in again.
  const refresh = useCallback(async (api) => {
    try {
      const { data } = await api.get('/profile');
      if (data) persist(data);
      return data;
    } catch {
      return null; // a failed refresh must never sign the user out
    }
  }, []);

  useEffect(() => {
    if (user) refresh(API);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
