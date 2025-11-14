<template>
  <div class="kanban-board">
    <div v-if="tasks.length === 0" class="empty-state">
      <p>No tasks found. Create your first task!</p>
    </div>
    <div v-else class="kanban-columns">
      <div
        v-for="status in statuses"
        :key="status.id"
        class="kanban-column"
      >
        <div class="column-header">
          <h3>{{ status.name }}</h3>
          <span class="task-count">
            {{ getTasksByStatus(status.id).length }}
          </span>
        </div>
        <div class="column-content">
          <div
            v-for="task in getTasksByStatus(status.id)"
            :key="task.id"
            class="kanban-card"
            @click="$emit('edit', task)"
          >
            <div class="card-header">
              <h4>{{ task.title }}</h4>
            </div>
            <div class="card-body">
              <p class="card-description" v-if="task.description">
                {{ truncate(task.description, 100) }}
              </p>
              <div class="card-meta">
                <span class="meta-item">
                  <strong>Assigned to:</strong> {{ task.assignedUser.name }}
                </span>
                <span class="meta-item">
                  <strong>Start:</strong> {{ formatDate(task.startDate) }}
                </span>
                <span class="meta-item">
                  <strong>End:</strong> {{ formatDate(task.endDate) }}
                </span>
              </div>
            </div>
            <div class="card-actions">
              <button
                @click.stop="$emit('edit', task)"
                class="btn-icon"
                title="Edit"
              >
                ✏️
              </button>
              <button
                @click.stop="handleReassign(task)"
                class="btn-icon"
                title="Reassign"
              >
                🔄
              </button>
              <button
                @click.stop="$emit('delete', task.id)"
                class="btn-icon"
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <ReassignModal
      v-if="showReassignModal && taskToReassign"
      :task="taskToReassign"
      :users="users"
      @close="closeReassignModal"
      @confirm="handleConfirmReassign"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { format } from 'date-fns';
import type { Task } from '../stores/tasks';
import ReassignModal from './ReassignModal.vue';
import { fetchUsers } from '../services/users';

const props = defineProps<{
  tasks: Task[];
  statuses: any[];
}>();

const emit = defineEmits<{
  edit: [task: Task];
  delete: [taskId: string];
  reassign: [taskId: string, userId: string];
}>();

const showReassignModal = ref(false);
const taskToReassign = ref<Task | null>(null);
const users = ref<any[]>([]);

function getTasksByStatus(statusId: string) {
  return props.tasks.filter((task) => task.status.id === statusId);
}

function formatDate(dateString: string) {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch {
    return dateString;
  }
}

function truncate(text: string, length: number) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

async function handleReassign(task: Task) {
  if (users.value.length === 0) {
    await loadUsers();
  }
  taskToReassign.value = task;
  showReassignModal.value = true;
}

async function loadUsers() {
  try {
    users.value = await fetchUsers();
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

function closeReassignModal() {
  showReassignModal.value = false;
  taskToReassign.value = null;
}

async function handleConfirmReassign(userId: string) {
  if (taskToReassign.value) {
    // Emit to parent - parent will handle errors via ErrorModal
    emit('reassign', taskToReassign.value.id, userId);
    closeReassignModal();
  }
}
</script>

<style scoped>
.kanban-board {
  width: 100%;
  overflow-x: auto;
  padding: 1rem;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #999;
}

.kanban-columns {
  display: flex;
  gap: 1rem;
  min-width: fit-content;
}

.kanban-column {
  min-width: 300px;
  max-width: 300px;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e0e0e0;
}

.column-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.task-count {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.column-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.kanban-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e0e0e0;
}

.kanban-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.card-header h4 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.card-body {
  margin-bottom: 0.75rem;
}

.card-description {
  font-size: 0.9rem;
  color: #666;
  margin: 0 0 0.75rem 0;
  line-height: 1.4;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-item {
  font-size: 0.85rem;
  color: #555;
}

.meta-item strong {
  color: #333;
  margin-right: 0.5rem;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
  border-top: 1px solid #f0f0f0;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #f5f5f5;
}

.column-content::-webkit-scrollbar {
  width: 6px;
}

.column-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.column-content::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.column-content::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>

