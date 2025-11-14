<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Reassign Task</h2>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <p>Reassign "{{ task.title }}" to:</p>
        <select v-model="selectedUserId" class="user-select">
          <option value="">Select a user</option>
          <option v-for="user in users" :key="user.id" :value="user.id">
            {{ user.name }}
          </option>
        </select>
        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
      <div class="modal-actions">
        <button @click="close" class="btn-cancel">Cancel</button>
        <button @click="handleConfirm" :disabled="!selectedUserId || loading" class="btn-confirm">
          {{ loading ? 'Reassigning...' : 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Task } from '../stores/tasks';

const props = defineProps<{
  task: Task | null;
  users: any[];
}>();

const emit = defineEmits<{
  close: [];
  confirm: [userId: string];
}>();

const selectedUserId = ref<string | null>(null);
const error = ref('');
const loading = ref(false);

function close() {
  error.value = '';
  selectedUserId.value = null;
  emit('close');
}

async function handleConfirm() {
  if (selectedUserId.value) {
    error.value = '';
    loading.value = true;
    try {
      emit('confirm', selectedUserId.value);
      // The parent (Dashboard) will handle the actual reassign and show errors via ErrorModal if needed
      // Close the modal - errors will be shown in the ErrorModal
      close();
    } catch (err: any) {
      // This catch is for unexpected errors during emit
      error.value = err?.message || err?.response?.data?.message || 'Failed to reassign task';
    } finally {
      loading.value = false;
    }
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
  max-width: 400px;
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

.modal-body {
  padding: 1.5rem;
}

.modal-body p {
  margin-bottom: 1rem;
  color: #555;
}

.user-select {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.user-select:focus {
  outline: none;
  border-color: #667eea;
}

.error-message {
  color: #e74c3c;
  font-size: 0.9rem;
  padding: 0.75rem;
  background: #fee;
  border-radius: 6px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1.5rem;
  border-top: 1px solid #e0e0e0;
}

.btn-cancel,
.btn-confirm {
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

.btn-confirm {
  background: #667eea;
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  background: #5568d3;
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

