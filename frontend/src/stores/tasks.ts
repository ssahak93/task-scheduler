import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';

export interface Task {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  assignedUser: {
    id: string;
    name: string;
    email: string;
  };
  status: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchTasks(filters?: {
    statusId?: number | string;
    assignedUserId?: number | string;
    search?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const params = new URLSearchParams();
      if (filters?.statusId) params.append('statusId', String(filters.statusId));
      if (filters?.assignedUserId) params.append('assignedUserId', String(filters.assignedUserId));
      if (filters?.search) params.append('search', filters.search);
      const queryString = params.toString();
      const response = await api.get(`/tasks${queryString ? `?${queryString}` : ''}`);
      tasks.value = response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch tasks';
    } finally {
      loading.value = false;
    }
  }

  async function createTask(taskData: any) {
    try {
      const response = await api.post('/tasks', taskData);
      // Don't fetch here - Socket.IO will handle the refresh
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create task';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  async function updateTask(id: string, taskData: any) {
    try {
      const response = await api.patch(`/tasks/${id}`, taskData);
      // Don't fetch here - Socket.IO will handle the refresh
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update task';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  async function reassignTask(id: string, assignedUserId: string) {
    try {
      const response = await api.patch(`/tasks/${id}/reassign`, { assignedUserId });
      // Don't fetch here - Socket.IO will handle the refresh
      return { success: true, data: response.data };
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to reassign task';
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  async function deleteTask(id: string) {
    try {
      await api.delete(`/tasks/${id}`);
      // Don't fetch here - Socket.IO will handle the refresh
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.message || 'Failed to delete task',
      };
    }
  }

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    reassignTask,
    deleteTask,
  };
});

