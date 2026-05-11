import axios from 'axios';

const API_URL = 'http://localhost:4000/api/auth';
const USER_KEY = 'user';

const getSessionStore = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
};

const getLocalStore = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const safeParse = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const login = async (email, password) => {
  const response = await axios.post(`${API_URL}/login`, { email, password });
  if (response.data.token) {
    const sessionStore = getSessionStore();
    const localStore = getLocalStore();
    sessionStore?.setItem(USER_KEY, JSON.stringify(response.data));
    // Limpiar sesión legada compartida entre pestañas.
    localStore?.removeItem(USER_KEY);
  }
  return response.data;
};

const logout = () => {
  const sessionStore = getSessionStore();
  const localStore = getLocalStore();
  sessionStore?.removeItem(USER_KEY);
  localStore?.removeItem(USER_KEY);
};

const getCurrentUser = () => {
  const sessionStore = getSessionStore();
  const localStore = getLocalStore();

  const sessionUser = safeParse(sessionStore?.getItem(USER_KEY));
  if (sessionUser) return sessionUser;

  // Compatibilidad: migrar una sesión antigua desde localStorage a sessionStorage.
  const legacyUser = safeParse(localStore?.getItem(USER_KEY));
  if (legacyUser) {
    sessionStore?.setItem(USER_KEY, JSON.stringify(legacyUser));
    localStore?.removeItem(USER_KEY);
    return legacyUser;
  }

  return null;
};

const getAuthHeader = () => {
  const user = getCurrentUser();
  if (user?.token) {
    return { Authorization: `Bearer ${user.token}` };
  }
  return {};
};

export default { login, logout, getCurrentUser, getAuthHeader };