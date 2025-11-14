import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  );

  const isAuthenticated = computed(() => !!token.value);

  async function login(email: string, password: string) {
    try {
      const response = await api.post('/auth/login', { email, password });
      token.value = response.data.access_token;
      user.value = response.data.user;
      localStorage.setItem('token', token.value);
      localStorage.setItem('user', JSON.stringify(user.value));
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`;
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
      };
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
  }

  function init() {
    if (token.value) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`;
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    login,
    logout,
    init,
  };
});

