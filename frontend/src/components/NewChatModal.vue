<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <div class="modal-header">
        <h2>New Chat</h2>
        <button @click="close" class="close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="chat-type-selector">
          <button
            @click="chatType = 'direct'"
            :class="['type-btn', { active: chatType === 'direct' }]"
          >
            Direct Message
          </button>
          <button
            @click="chatType = 'group'"
            :class="['type-btn', { active: chatType === 'group' }]"
          >
            Group Chat
          </button>
        </div>

        <div v-if="chatType === 'direct'" class="direct-chat-section">
          <label>Select User:</label>
          <select v-model="selectedUserId" class="user-select">
            <option value="">Choose a user...</option>
            <option v-for="user in availableUsers" :key="user.id" :value="user.id">
              {{ user.name }} ({{ user.email }})
            </option>
          </select>
        </div>

        <div v-if="chatType === 'group'" class="group-chat-section">
          <label>Group Name:</label>
          <input
            v-model="groupName"
            type="text"
            placeholder="Enter group name..."
            class="group-name-input"
          />
          <label>Select Participants:</label>
          <div class="participants-list">
            <label
              v-for="user in availableUsers"
              :key="user.id"
              class="participant-item"
            >
              <input
                type="checkbox"
                :value="user.id"
                v-model="selectedParticipants"
              />
              <span>{{ user.name }}</span>
            </label>
          </div>
        </div>

        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
      <div class="modal-actions">
        <button @click="close" class="btn-cancel">Cancel</button>
        <button @click="createChat" class="btn-confirm" :disabled="!canCreate">
          Create
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useChatStore } from '../stores/chat';
import { usersService } from '../services/users';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
  created: [chatId: string];
}>();

const chatStore = useChatStore();
const authStore = useAuthStore();

const chatType = ref<'direct' | 'group'>('direct');
const selectedUserId = ref('');
const groupName = ref('');
const selectedParticipants = ref<string[]>([]);
const error = ref('');
const availableUsers = ref<any[]>([]);

async function loadUsers() {
  try {
    availableUsers.value = await usersService.getUsers();
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

const canCreate = computed(() => {
  if (chatType.value === 'direct') {
    return !!selectedUserId.value;
  } else {
    return !!groupName.value && selectedParticipants.value.length >= 2;
  }
});

async function createChat() {
  error.value = '';
  try {
    if (chatType.value === 'direct') {
      const chat = await chatStore.createDirectChat(selectedUserId.value);
      emit('created', chat._id);
    } else {
      const chat = await chatStore.createGroupChat(groupName.value, selectedParticipants.value);
      emit('created', chat._id);
    }
    close();
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Failed to create chat';
  }
}

function close() {
  chatType.value = 'direct';
  selectedUserId.value = '';
  groupName.value = '';
  selectedParticipants.value = [];
  error.value = '';
  emit('close');
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    chatType.value = 'direct';
    selectedUserId.value = '';
    groupName.value = '';
    selectedParticipants.value = [];
    error.value = '';
    loadUsers();
  }
});
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
  z-index: 2000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
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
  overflow-y: auto;
  flex: 1;
}

.chat-type-selector {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.type-btn {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1rem;
}

.type-btn:hover {
  border-color: #667eea;
}

.type-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.direct-chat-section,
.group-chat-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

label {
  font-weight: 600;
  color: #333;
  font-size: 0.875rem;
}

.user-select,
.group-name-input {
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
}

.group-name-input:focus,
.user-select:focus {
  outline: none;
  border-color: #667eea;
}

.participants-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 0.5rem;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s;
}

.participant-item:hover {
  background: #f0f0f0;
}

.participant-item input[type="checkbox"] {
  cursor: pointer;
}

.error-message {
  color: #e74c3c;
  font-size: 0.875rem;
  margin-top: 0.5rem;
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
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

