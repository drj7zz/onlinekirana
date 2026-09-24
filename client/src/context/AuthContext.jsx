import { createContext, useContext, useState, useCallback } from 'react';
import { setToken } from '../api';

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

  const login = useCallback(async (api, email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
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

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
