import api from './api';

export async function fetchStatuses() {
  const response = await api.get('/statuses');
  return response.data;
}



