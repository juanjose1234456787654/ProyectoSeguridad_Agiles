import axios from 'axios';

const API_URL = 'http://localhost:4000/api/auth';

const login = async (email, password) => {
  const response = await axios.post(`${API_URL}/login`, { email, password });
  if (response.data.token) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }
  return response.data;
};

const logout = () => {
  localStorage.removeItem('user');
};

const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem('user'));
};

const getAuthHeader = () => {
  const user = getCurrentUser();
  if (user?.token) {
    return { Authorization: `Bearer ${user.token}` };
  }
  return {};
};

export default { login, logout, getCurrentUser, getAuthHeader };