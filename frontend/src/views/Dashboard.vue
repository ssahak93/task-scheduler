<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>Task Scheduler Dashboard</h1>
      <div class="header-actions">
        <NotificationBadge />
        <span class="user-info">{{ authStore.user?.name }}</span>
        <button @click="handleLogout" class="logout-btn">Logout</button>
      </div>
    </header>
    <div class="dashboard-content">
      <div class="filters-section">
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search tasks by title or description..."
            @input="handleSearch"
            class="search-input"
          />
        </div>
        <div class="filter-controls">
          <select v-model="selectedStatus" @change="handleSearch" class="filter-select">
            <option value="">All Statuses</option>
            <option v-for="status in statuses" :key="status.id" :value="status.id">
              {{ status.name }}
            </option>
          </select>
          <select v-model="selectedUser" @change="handleSearch" class="filter-select">
            <option value="">All Users</option>
            <option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.name }}
            </option>
          </select>
          <div class="view-toggle">
            <button
              @click="viewMode = 'list'"
              :class="['view-btn', { active: viewMode === 'list' }]"
              title="List View"
            >
              📋
            </button>
            <button
              @click="viewMode = 'kanban'"
              :class="['view-btn', { active: viewMode === 'kanban' }]"
              title="Kanban View"
            >
              📊
            </button>
          </div>
          <button @click="openModal(null)" class="create-btn">Create Task</button>
        </div>
      </div>
      <div v-if="tasksStore.loading" class="loading">Loading tasks...</div>
      <div v-else-if="tasksStore.error" class="error">{{ tasksStore.error }}</div>
      <div v-else class="task-board">
        <TaskList
          v-if="viewMode === 'list'"
          :tasks="tasksStore.tasks"
          @edit="openModal"
          @delete="handleDelete"
          @reassign="handleReassign"
        />
        <TaskKanban
          v-else
          :tasks="tasksStore.tasks"
          :statuses="statuses"
          @edit="openModal"
          @delete="handleDelete"
          @reassign="handleReassign"
        />
      </div>
    </div>
    <TaskModal
      v-if="showModal"
      :task="selectedTask"
      :users="users"
      :statuses="statuses"
      @close="closeModal"
      @save="handleSaveTask"
    />
    <ErrorModal
      :show="showErrorModal"
      :message="errorMessage"
      @close="closeErrorModal"
    />
    <ConfirmModal
      :show="showConfirmModal"
      :message="confirmMessage"
      @close="closeConfirmModal"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/auth';
import { useTasksStore } from '../stores/tasks';
import { fetchUsers } from '../services/users';
import { fetchStatuses } from '../services/statuses';
import TaskList from '../components/TaskList.vue';
import TaskKanban from '../components/TaskKanban.vue';
import TaskModal from '../components/TaskModal.vue';
import NotificationBadge from '../components/NotificationBadge.vue';
import ErrorModal from '../components/ErrorModal.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import type { Task } from '../stores/tasks';

const router = useRouter();
const authStore = useAuthStore();
const tasksStore = useTasksStore();

authStore.init();

const users = ref<any[]>([]);
const statuses = ref<any[]>([]);
const searchQuery = ref('');
const selectedStatus = ref<string>('');
const selectedUser = ref<string>('');
const showModal = ref(false);
const selectedTask = ref<Task | null>(null);
const viewMode = ref<'list' | 'kanban'>('kanban');
const showErrorModal = ref(false);
const errorMessage = ref('');
const showConfirmModal = ref(false);
const confirmMessage = ref('');
const taskToDelete = ref<string | null>(null);
let tasksSocket: Socket | null = null;

async function loadInitialData() {
  try {
    [users.value, statuses.value] = await Promise.all([
      fetchUsers(),
      fetchStatuses(),
    ]);
    await tasksStore.fetchTasks();
  } catch (error: any) {
    // Error is handled by stores
  }
}

function getCurrentFilters() {
  const filters: any = {};
  if (searchQuery.value) filters.search = searchQuery.value;
  if (selectedStatus.value) filters.statusId = selectedStatus.value;
  if (selectedUser.value) filters.assignedUserId = selectedUser.value;
  return filters;
}

function connectTasksSocket() {
  const token = authStore.token?.value || localStorage.getItem('token');
  
  if (!token) {
    return;
  }

  tasksSocket = io('/tasks', {
    auth: { token },
    transports: ['websocket', 'polling'],
    path: '/socket.io/',
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  // Debounce function to prevent multiple rapid requests
  let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  const refreshTaskList = () => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    refreshTimeout = setTimeout(() => {
      if (!tasksStore.loading) {
        tasksStore.fetchTasks(getCurrentFilters());
      }
    }, 100); // Small delay to batch rapid events
  };

  tasksSocket.on('task:created', () => {
    refreshTaskList();
  });

  tasksSocket.on('task:updated', () => {
    refreshTaskList();
  });

  tasksSocket.on('task:reassigned', () => {
    refreshTaskList();
  });

  tasksSocket.on('task:deleted', () => {
    refreshTaskList();
  });

  tasksSocket.on('connect_error', (error) => {
    console.error('[Dashboard] Tasks Socket.IO connection error:', error.message);
  });
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/login');
    return;
  }
  await loadInitialData();
  connectTasksSocket();
});

onUnmounted(() => {
  if (tasksSocket) {
    tasksSocket.disconnect();
    tasksSocket = null;
  }
});

function handleSearch() {
  tasksStore.fetchTasks(getCurrentFilters());
}

function openModal(task: Task | null) {
  selectedTask.value = task;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  selectedTask.value = null;
}

async function handleSaveTask(taskData: any) {
  try {
    let result;
    if (selectedTask.value) {
      result = await tasksStore.updateTask(selectedTask.value.id, taskData);
    } else {
      result = await tasksStore.createTask(taskData);
    }
    
    if (result.success) {
      closeModal();
      // Don't fetch here - Socket.IO will handle the refresh automatically
    } else {
      // Show error in modal
      errorMessage.value = result.message || 'Failed to save task';
      showErrorModal.value = true;
    }
  } catch (err: any) {
    // Catch any unexpected errors
    const message = err?.response?.data?.message || err?.message || 'An unexpected error occurred';
    errorMessage.value = message;
    showErrorModal.value = true;
  }
}

function closeErrorModal() {
  showErrorModal.value = false;
  errorMessage.value = '';
}

function handleDelete(taskId: string) {
  taskToDelete.value = taskId;
  confirmMessage.value = 'Are you sure you want to delete this task?';
  showConfirmModal.value = true;
}

function closeConfirmModal() {
  showConfirmModal.value = false;
  confirmMessage.value = '';
  taskToDelete.value = null;
}

async function confirmDelete() {
  if (taskToDelete.value) {
    const result = await tasksStore.deleteTask(taskToDelete.value);
    if (!result.success) {
      errorMessage.value = result.message || 'Failed to delete task';
      showErrorModal.value = true;
    }
    // Don't fetch here - Socket.IO will handle the refresh automatically
  }
  closeConfirmModal();
}

async function handleReassign(taskId: string, userId: string) {
  const result = await tasksStore.reassignTask(taskId, userId);
  if (!result.success) {
    errorMessage.value = result.message || 'Failed to reassign task';
    showErrorModal.value = true;
  }
  // Don't fetch here - Socket.IO will handle the refresh automatically
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #f5f5f5;
}

.dashboard-header {
  background: white;
  padding: 1.5rem 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-header h1 {
  color: #333;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  color: #666;
  font-weight: 500;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background 0.2s;
}

.logout-btn:hover {
  background: #c0392b;
}

.dashboard-content {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.filters-section {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.search-box {
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
}

.filter-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.filter-select {
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
}

.view-toggle {
  display: flex;
  gap: 0.5rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.25rem;
  background: white;
}

.view-btn {
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn:hover {
  background: #f5f5f5;
}

.view-btn.active {
  background: #667eea;
  color: white;
}

.create-btn {
  padding: 0.75rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.create-btn:hover {
  background: #5568d3;
}

.loading,
.error {
  text-align: center;
  padding: 2rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.error {
  color: #e74c3c;
}

.task-board {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
</style>

