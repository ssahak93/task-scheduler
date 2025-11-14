<template>
  <div class="chat-window">
    <div v-if="!activeChat" class="empty-chat">
      <p>Select a chat to start messaging</p>
    </div>
    <div v-else class="chat-container">
      <div class="chat-header">
        <div class="chat-header-info">
          <div class="chat-avatar-small">
            <span v-if="activeChat.type === 'direct'">
              {{ getChatName(activeChat).charAt(0).toUpperCase() }}
            </span>
            <span v-else>👥</span>
          </div>
          <div>
            <h3>{{ getChatName(activeChat) }}</h3>
            <p v-if="activeChat.type === 'group'" class="chat-meta">
              {{ activeChat.participants?.length || 0 }} participants
            </p>
            <p v-else class="chat-meta">Online</p>
          </div>
        </div>
        <div v-if="activeChat.type === 'group'" class="chat-actions">
          <button @click="$emit('group-settings')" class="icon-btn" title="Group Settings">
            ⚙️
          </button>
        </div>
      </div>

      <div ref="messagesContainer" class="messages-container" @scroll="handleScroll">
        <div v-if="loadingMessages" class="loading">Loading messages...</div>
        <div v-for="message in activeMessages" :key="message._id" class="message-wrapper">
          <div
            :class="['message', { 'own-message': message.senderId === currentUserId }]"
          >
            <div v-if="message.senderId !== currentUserId" class="message-sender">
              {{ message.sender?.name || 'Unknown' }}
            </div>
            <div v-if="message.replyTo" class="message-reply">
              <div class="reply-content">
                <strong>{{ message.replyTo.sender?.name }}:</strong>
                {{ message.replyTo.content || 'Media' }}
              </div>
            </div>
            <div class="message-content">
              <div v-if="message.type === 'text' || message.type === 'emoji'" class="text-content">
                {{ message.content }}
              </div>
              <div v-else-if="message.type === 'image'" class="image-content">
                <img :src="getFileUrl(message.fileUrl)" :alt="message.fileName" />
              </div>
              <div v-else-if="message.type === 'voice'" class="voice-content">
                <audio controls :src="getFileUrl(message.fileUrl)">
                  Your browser does not support audio.
                </audio>
              </div>
              <div v-else-if="message.type === 'file'" class="file-content">
                <a :href="getFileUrl(message.fileUrl)" :download="message.fileName" class="file-link">
                  📎 {{ message.fileName }}
                </a>
              </div>
              <div v-else-if="message.type === 'sticker'" class="sticker-content">
                {{ message.content }}
              </div>
            </div>
            <div class="message-footer">
              <span class="message-time">{{ formatTime(message.createdAt) }}</span>
              <span v-if="message.editedAt" class="edited-badge">edited</span>
              <span v-if="message.senderId === currentUserId && message.read" class="read-indicator">✓✓</span>
            </div>
            <div v-if="message.reactions && Object.keys(message.reactions).length > 0" class="message-reactions">
              <button
                v-for="(userIds, emoji) in message.reactions"
                :key="emoji"
                @click="toggleReaction(message._id, emoji)"
                :class="['reaction-btn', { active: userIds.includes(currentUserId) }]"
                :title="getReactionTooltip(userIds)"
              >
                {{ emoji }} {{ userIds.length }}
              </button>
              <button @click="showReactionPicker(message._id)" class="add-reaction-btn" title="Add reaction">+</button>
            </div>
            <div v-else class="message-reactions-placeholder">
              <button @click="showReactionPicker(message._id)" class="add-reaction-btn-small" title="Add reaction">+</button>
            </div>
          </div>
        </div>
        <div v-if="typingUsers.length > 0" class="typing-indicator">
          <span>{{ typingUsers.map(id => getUserName(id)).join(', ') }} typing...</span>
        </div>
        <div v-if="reactionPickerMessageId" class="reaction-picker-overlay" @click.self="reactionPickerMessageId = null">
          <div class="reaction-picker">
            <div class="reaction-picker-grid">
              <button
                v-for="emoji in commonReactions"
                :key="emoji"
                @click="toggleReaction(reactionPickerMessageId, emoji); reactionPickerMessageId = null"
                class="reaction-picker-btn"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <MessageInput
        :chat-id="activeChat._id"
        @send="handleSendMessage"
        @typing-start="handleTypingStart"
        @typing-stop="handleTypingStop"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useChatStore } from '../stores/chat';
import { useAuthStore } from '../stores/auth';
import { usersService } from '../services/users';
import MessageInput from './MessageInput.vue';
import { format } from 'date-fns';

const props = defineProps<{
  activeChat: any | null;
}>();

defineEmits<{
  'group-settings': [];
}>();

const chatStore = useChatStore();
const authStore = useAuthStore();
const messagesContainer = ref<HTMLElement | null>(null);
const loadingMessages = ref(false);

const activeMessages = computed(() => chatStore.activeMessages);
const currentUserId = computed(() => authStore.user?.id || '');
const typingUsers = computed(() => {
  if (!props.activeChat) return [];
  const users = chatStore.typingUsers.get(props.activeChat._id) || [];
  // Filter out current user (they shouldn't see their own typing indicator)
  return users.filter((id: string) => id !== currentUserId.value);
});
const allUsers = ref<any[]>([]);
const reactionPickerMessageId = ref<string | null>(null);

const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '🎉', '💯'];

function getChatName(chat: any): string {
  if (chat.type === 'group') {
    return chat.name || 'Group Chat';
  }
  const otherUser = chat.participants?.find((p: any) => p.id !== authStore.user?.id);
  return otherUser?.name || 'Unknown User';
}

function getUserName(userId: string): string {
  if (!props.activeChat) return '';
  const user = props.activeChat.participants?.find((p: any) => p.id === userId);
  return user?.name || 'Someone';
}

function formatTime(dateString: string): string {
  try {
    return format(new Date(dateString), 'HH:mm');
  } catch {
    return '';
  }
}

function getFileUrl(fileUrl: string | undefined): string {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('http')) return fileUrl;
  const apiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost';
  return `${apiUrl}${fileUrl}`;
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  if (target.scrollTop === 0 && !loadingMessages.value) {
    loadMoreMessages();
  }
}

async function loadMoreMessages() {
  if (!props.activeChat || loadingMessages.value) return;
  loadingMessages.value = true;
  try {
    const currentCount = activeMessages.value.length;
    await chatStore.fetchMessages(props.activeChat._id, 50, currentCount);
  } catch (error) {
    console.error('Failed to load more messages:', error);
  } finally {
    loadingMessages.value = false;
  }
}

async function handleSendMessage(messageData: any) {
  if (!props.activeChat) return;
  
  try {
    await chatStore.sendMessage(
      props.activeChat._id,
      messageData.content || '',
      messageData.type || 'text',
      messageData.replyToId,
      messageData.file,
      messageData.fileUrl,
      messageData.fileName,
      messageData.fileSize,
      messageData.mimeType
    );
    scrollToBottom();
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

function handleTypingStart() {
  if (props.activeChat) {
    chatStore.startTyping(props.activeChat._id);
  }
}

function handleTypingStop() {
  if (props.activeChat) {
    chatStore.stopTyping(props.activeChat._id);
  }
}

async function toggleReaction(messageId: string, emoji: string) {
  try {
    await chatStore.toggleReaction(messageId, emoji);
  } catch (error) {
    console.error('Failed to toggle reaction:', error);
  }
}

function showReactionPicker(messageId: string) {
  reactionPickerMessageId.value = reactionPickerMessageId.value === messageId ? null : messageId;
}

function getReactionTooltip(userIds: string[]): string {
  if (!allUsers.value.length) return `${userIds.length} reactions`;
  const names = userIds
    .map(id => {
      const user = allUsers.value.find(u => u.id === id);
      return user?.name || 'Unknown';
    })
    .slice(0, 3);
  if (userIds.length > 3) {
    names.push(`and ${userIds.length - 3} more`);
  }
  return names.join(', ');
}

async function loadUsers() {
  try {
    allUsers.value = await usersService.getUsers();
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

const lastFetchedChatId = ref<string | null>(null);

watch(() => props.activeChat?._id, async (chatId) => {
  if (chatId && chatId !== lastFetchedChatId.value) {
    lastFetchedChatId.value = chatId;
    await chatStore.fetchMessages(chatId);
    scrollToBottom();
    chatStore.markAsRead(chatId);
  }
});

watch(activeMessages, () => {
  scrollToBottom();
}, { deep: true });

watch(typingUsers, () => {
  // Scroll down when typing indicator appears
  if (typingUsers.value.length > 0) {
    scrollToBottom();
  }
}, { deep: true });

onMounted(() => {
  if (props.activeChat) {
    scrollToBottom();
  }
  loadUsers();
});
</script>

<style scoped>
.chat-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.empty-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: white;
}

.chat-header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.chat-avatar-small {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #667eea;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1rem;
}

.chat-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #333;
}

.chat-meta {
  margin: 0;
  font-size: 0.75rem;
  color: #999;
}

.chat-actions {
  display: flex;
  gap: 0.5rem;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background 0.2s;
}

.icon-btn:hover {
  background: #f0f0f0;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.loading {
  text-align: center;
  color: #999;
  padding: 1rem;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
}

.message {
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  background: #f0f0f0;
  word-wrap: break-word;
}

.message.own-message {
  align-self: flex-end;
  background: #667eea;
  color: white;
}

.message-sender {
  font-size: 0.75rem;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 0.25rem;
}

.message.own-message .message-sender {
  color: rgba(255, 255, 255, 0.8);
}

.message-reply {
  border-left: 3px solid #667eea;
  padding-left: 0.5rem;
  margin-bottom: 0.5rem;
  opacity: 0.8;
  font-size: 0.875rem;
}

.message.own-message .message-reply {
  border-left-color: rgba(255, 255, 255, 0.8);
}

.text-content {
  white-space: pre-wrap;
}

.image-content img {
  max-width: 100%;
  border-radius: 8px;
}

.voice-content audio {
  width: 100%;
}

.file-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: inherit;
  text-decoration: none;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

.message-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  opacity: 0.7;
}

.edited-badge {
  font-style: italic;
}

.read-indicator {
  margin-left: auto;
}

.typing-indicator {
  padding: 0.5rem;
  font-size: 0.875rem;
  color: #999;
  font-style: italic;
}

.message-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.message.own-message .message-reactions {
  border-top-color: rgba(255, 255, 255, 0.2);
}

.reaction-btn {
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.message.own-message .reaction-btn {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: white;
}

.reaction-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  transform: scale(1.05);
}

.message.own-message .reaction-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.reaction-btn.active {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

.message.own-message .reaction-btn.active {
  background: rgba(255, 255, 255, 0.4);
}

.add-reaction-btn,
.add-reaction-btn-small {
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  color: #999;
}

.message.own-message .add-reaction-btn,
.message.own-message .add-reaction-btn-small {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.8);
}

.add-reaction-btn:hover,
.add-reaction-btn-small:hover {
  background: rgba(0, 0, 0, 0.1);
}

.message.own-message .add-reaction-btn:hover,
.message.own-message .add-reaction-btn-small:hover {
  background: rgba(255, 255, 255, 0.3);
}

.add-reaction-btn-small {
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-wrapper:hover .add-reaction-btn-small {
  opacity: 1;
}

.message-reactions-placeholder {
  margin-top: 0.25rem;
}

.reaction-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.reaction-picker {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.reaction-picker-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.5rem;
}

.reaction-picker-btn {
  background: none;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 0.75rem;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.reaction-picker-btn:hover {
  background: #f0f0f0;
  transform: scale(1.1);
}
</style>

