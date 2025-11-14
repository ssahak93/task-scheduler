<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ task ? 'Edit Task' : 'Create Task' }}</h2>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      <form @submit.prevent="handleSubmit" class="modal-form">
        <div class="form-group">
          <label for="title">Title *</label>
          <input
            id="title"
            v-model="formData.title"
            type="text"
            required
            placeholder="Enter task title"
          />
        </div>
        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            v-model="formData.description"
            rows="3"
            placeholder="Enter task description"
          ></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="startDate">Start Date *</label>
            <input
              id="startDate"
              v-model="formData.startDate"
              type="date"
              required
            />
          </div>
          <div class="form-group">
            <label for="endDate">End Date *</label>
            <input
              id="endDate"
              v-model="formData.endDate"
              type="date"
              required
            />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="assignedUser">Assigned User *</label>
            <select
              id="assignedUser"
              v-model="formData.assignedUserId"
              required
            >
              <option value="">Select a user</option>
              <option v-for="user in users" :key="user.id" :value="user.id">
                {{ user.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="status">Status *</label>
            <select
              id="status"
              v-model="formData.statusId"
              required
            >
              <option value="">Select a status</option>
              <option v-for="status in statuses" :key="status.id" :value="status.id">
                {{ status.name }}
              </option>
            </select>
          </div>
        </div>
        <div v-if="error" class="error-message">{{ error }}</div>
        <div class="modal-actions">
          <button type="button" @click="close" class="btn-cancel">Cancel</button>
          <button type="submit" :disabled="loading" class="btn-submit">
            {{ loading ? 'Saving...' : task ? 'Update' : 'Create' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import type { Task } from '../stores/tasks';

const props = defineProps<{
  task: Task | null;
  users: any[];
  statuses: any[];
}>();

const emit = defineEmits<{
  close: [];
  save: [taskData: any];
}>();

const loading = ref(false);
const error = ref('');

const formData = reactive({
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  assignedUserId: '',
  statusId: '',
});

watch(
  () => props.task,
  (newTask) => {
    if (newTask) {
      formData.title = newTask.title;
      formData.description = newTask.description || '';
      formData.startDate = newTask.startDate.split('T')[0];
      formData.endDate = newTask.endDate.split('T')[0];
      formData.assignedUserId = newTask.assignedUser.id;
      formData.statusId = newTask.status.id;
    } else {
      resetForm();
    }
  },
  { immediate: true },
);

function resetForm() {
  formData.title = '';
  formData.description = '';
  formData.startDate = '';
  formData.endDate = '';
  formData.assignedUserId = '';
  formData.statusId = '';
  error.value = '';
}

function close() {
  emit('close');
  resetForm();
}

async function handleSubmit() {
  error.value = '';
  loading.value = true;

  if (new Date(formData.startDate) > new Date(formData.endDate)) {
    error.value = 'Start date must be before end date';
    loading.value = false;
    return;
  }

  try {
    await emit('save', { ...formData });
    // The parent component (Dashboard) will handle errors and close the modal on success
    // We keep the modal open if there's an error so the user can see it
  } catch (err: any) {
    // Extract error message from the error object
    const errorMessage = err?.response?.data?.message || err?.message || 'Failed to save task';
    error.value = errorMessage;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 1.5rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: #999;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.modal-form {
  padding: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.form-group label {
  font-weight: 500;
  color: #555;
}

.form-group input,
.form-group textarea,
.form-group select {
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.error-message {
  color: #e74c3c;
  font-size: 0.9rem;
  padding: 0.75rem;
  background: #fee;
  border-radius: 6px;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.btn-cancel,
.btn-submit {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #e0e0e0;
  color: #333;
}

.btn-cancel:hover {
  background: #d0d0d0;
}

.btn-submit {
  background: #667eea;
  color: white;
}

.btn-submit:hover:not(:disabled) {
  background: #5568d3;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

