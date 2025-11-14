<template>
  <div class="task-list">
    <div v-if="tasks.length === 0" class="empty-state">
      <p>No tasks found. Create your first task!</p>
    </div>
    <table v-else class="tasks-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Description</th>
          <th>Assigned User</th>
          <th>Start Date</th>
          <th>End Date</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="task in tasks" :key="task.id" class="task-row">
          <td>{{ task.title }}</td>
          <td>{{ task.description || '-' }}</td>
          <td>{{ task.assignedUser.name }}</td>
          <td>{{ formatDate(task.startDate) }}</td>
          <td>{{ formatDate(task.endDate) }}</td>
          <td>
            <span :class="['status-badge', `status-${task.status.slug}`]">
              {{ task.status.name }}
            </span>
          </td>
          <td>
            <div class="actions">
              <button @click="$emit('edit', task)" class="btn-edit">Edit</button>
              <button @click="handleReassign(task)" class="btn-reassign">Reassign</button>
              <button @click="$emit('delete', task.id)" class="btn-delete">Delete</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
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
}>();

const emit = defineEmits<{
  edit: [task: Task];
  delete: [taskId: string];
  reassign: [taskId: string, userId: string];
}>();

const showReassignModal = ref(false);
const taskToReassign = ref<Task | null>(null);
const users = ref<any[]>([]);

async function loadUsers() {
  try {
    users.value = await fetchUsers();
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

function formatDate(dateString: string) {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch {
    return dateString;
  }
}

async function handleReassign(task: Task) {
  if (users.value.length === 0) {
    await loadUsers();
  }
  taskToReassign.value = task;
  showReassignModal.value = true;
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
.task-list {
  width: 100%;
}

.empty-state {
  padding: 3rem;
  text-align: center;
  color: #999;
}

.tasks-table {
  width: 100%;
  border-collapse: collapse;
}

.tasks-table thead {
  background: #f8f9fa;
}

.tasks-table th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e0e0e0;
}

.tasks-table td {
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  color: #555;
}

.task-row:hover {
  background: #f8f9fa;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
}

.status-pending {
  background: #fff3cd;
  color: #856404;
}

.status-in-progress {
  background: #d1ecf1;
  color: #0c5460;
}

.status-completed {
  background: #d4edda;
  color: #155724;
}

.status-cancelled {
  background: #f8d7da;
  color: #721c24;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.actions button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit {
  background: #667eea;
  color: white;
}

.btn-edit:hover {
  background: #5568d3;
}

.btn-reassign {
  background: #17a2b8;
  color: white;
}

.btn-reassign:hover {
  background: #138496;
}

.btn-delete {
  background: #e74c3c;
  color: white;
}

.btn-delete:hover {
  background: #c0392b;
}
</style>

