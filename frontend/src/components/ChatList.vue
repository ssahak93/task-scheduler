<template>
  <div class="chat-list">
    <div class="chat-list-header">
      <h2>Chats</h2>
      <button @click="emit('new-chat')" class="new-chat-btn" title="New Chat">+</button>
    </div>
    <div class="chat-list-content">
      <div
        v-for="chat in chats"
        :key="chat._id"
        @click="emit('select-chat', chat._id)"
        :class="['chat-item', { active: activeChatId === chat._id }]"
      >
        <div class="chat-avatar">
          <span v-if="chat.type === 'direct'">
            {{ getChatName(chat).charAt(0).toUpperCase() }}
          </span>
          <span v-else>👥</span>
        </div>
        <div class="chat-info">
          <div class="chat-name-row">
            <span class="chat-name">{{ getChatName(chat) }}</span>
            <span v-if="unreadCounts.get(chat._id)" class="unread-badge">
              {{ unreadCounts.get(chat._id) }}
            </span>
          </div>
          <div class="chat-preview">
            <span v-if="chat.lastMessageAt" class="chat-time">
              {{ formatTime(chat.lastMessageAt) }}
            </span>
          </div>
        </div>
      </div>
      <div v-if="chats.length === 0" class="empty-state">
        <p>No chats yet. Start a new conversation!</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useChatStore } from '../stores/chat';
import { useAuthStore } from '../stores/auth';
import { formatDistanceToNow } from 'date-fns';

const props = defineProps<{
  activeChatId: string | null;
}>();

const emit = defineEmits<{
  'select-chat': [chatId: string];
  'new-chat': [];
}>();

const chatStore = useChatStore();
const authStore = useAuthStore();

const chats = computed(() => chatStore.chats);
const unreadCounts = computed(() => chatStore.unreadCounts);

function getChatName(chat: any): string {
  if (chat.type === 'group') {
    return chat.name || 'Group Chat';
  }
  const otherUser = chat.participants?.find((p: any) => p.id !== authStore.user?.id);
  return otherUser?.name || 'Unknown User';
}

function formatTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return '';
  }
}
</script>

<style scoped>
.chat-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8f9fa;
  border-right: 1px solid #e0e0e0;
}

.chat-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: white;
}

.chat-list-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
}

.new-chat-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: #667eea;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.new-chat-btn:hover {
  background: #5568d3;
}

.chat-list-content {
  flex: 1;
  overflow-y: auto;
}

.chat-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  cursor: pointer;
  border-bottom: 1px solid #e0e0e0;
  transition: background 0.2s;
  background: white;
}

.chat-item:hover {
  background: #f0f0f0;
}

.chat-item.active {
  background: #e8eaf6;
  border-left: 3px solid #667eea;
}

.chat-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #667eea;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.25rem;
  margin-right: 0.75rem;
  flex-shrink: 0;
}

.chat-info {
  flex: 1;
  min-width: 0;
}

.chat-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
}

.chat-name {
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  background: #667eea;
  color: white;
  border-radius: 12px;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  min-width: 20px;
  text-align: center;
}

.chat-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-time {
  font-size: 0.75rem;
  color: #999;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #999;
}
</style>

