import api from './api';

export async function fetchUsers() {
  const response = await api.get('/users');
  return response.data;
}

export const usersService = {
  async getUsers() {
    const response = await api.get('/users');
    return response.data;
  },
};



