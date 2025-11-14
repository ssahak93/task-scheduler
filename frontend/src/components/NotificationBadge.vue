<template>
  <div class="notification-container">
    <button @click="toggleDropdown" class="notification-btn" :class="{ 'has-unread': unreadCount > 0 }">
      🔔
      <span v-if="unreadCount > 0" class="badge">{{ unreadCount }}</span>
    </button>
    
    <div v-if="showDropdown" class="notification-dropdown">
      <div class="notification-header">
        <h3>Notifications</h3>
        <button 
          v-if="unreadCount > 0" 
          @click="handleMarkAllRead" 
          class="mark-all-btn"
          :disabled="notificationsStore.loading"
        >
          Mark all as read
        </button>
      </div>
      
      <div v-if="notificationsStore.loading" class="loading">Loading...</div>
      <div v-else-if="notifications.length === 0" class="empty-state">
        <p>No notifications</p>
      </div>
      <div v-else class="notification-list">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="['notification-item', { unread: !notification.read }]"
          @click="handleNotificationClick(notification)"
        >
          <div class="notification-content">
            <p class="notification-message">{{ notification.message }}</p>
            <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
          </div>
          <button
            v-if="!notification.read"
            @click.stop="handleMarkRead(notification.id)"
            class="mark-read-btn"
            title="Mark as read"
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { io, Socket } from 'socket.io-client';
import { useNotificationsStore } from '../stores/notifications';
import { useAuthStore } from '../stores/auth';
import type { Notification } from '../services/notifications';
import { formatDistanceToNow } from 'date-fns';

const notificationsStore = useNotificationsStore();
const authStore = useAuthStore();
const showDropdown = ref(false);
let socket: Socket | null = null;

const notifications = computed(() => notificationsStore.notifications);
const unreadCount = computed(() => notificationsStore.unreadCount);

function toggleDropdown() {
  showDropdown.value = !showDropdown.value;
  if (showDropdown.value) {
    // Load notifications when dropdown opens
    notificationsStore.loadNotifications(false);
  }
}

function handleNotificationClick(notification: Notification) {
  if (!notification.read) {
    handleMarkRead(notification.id);
  }
}

async function handleMarkRead(notificationId: string) {
  try {
    await notificationsStore.markNotificationAsRead(notificationId);
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
  }
}

async function handleMarkAllRead() {
  try {
    await notificationsStore.markAllNotificationsAsRead();
  } catch (err) {
    console.error('Failed to mark all as read:', err);
  }
}

function formatTime(dateString: string): string {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch {
    return dateString;
  }
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!target.closest('.notification-container')) {
    showDropdown.value = false;
  }
}

function connectSocket() {
  if (socket?.connected) {
    return;
  }
  
  const userId = authStore.user?.id;
  const token = authStore.token?.value || localStorage.getItem('token') || null;
  
  if (userId && token) {
    socket = io('/notifications', {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: '/socket.io/',
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    
    socket.on('connect_error', (error) => {
      console.error('[NotificationBadge] Connection error:', error.message);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('[NotificationBadge] Reconnection failed');
    });
    
    socket.on('notifications', (notifications: Notification[]) => {
      // Initial notifications from Socket.IO - replace existing to avoid duplicates
      notificationsStore.notifications = [];
      notifications.forEach((n: Notification) => {
        notificationsStore.addNotification(n);
      });
    });
    
    socket.on('notification', (notification: Notification) => {
      // New notification received in real-time
      notificationsStore.addNotification(notification);
    });
  }
}

onMounted(() => {
  // Try to connect immediately
  connectSocket();
  
  // Retry after delay in case auth store isn't initialized yet
  setTimeout(() => {
    if (!socket?.connected) {
      connectSocket();
    }
  }, 500);
  
  // Watch for token changes (e.g., after login)
  watch(() => authStore.token?.value, (newToken) => {
    if (newToken && authStore.user?.id && !socket?.connected) {
      connectSocket();
    }
  });
  
  // Watch for user changes (e.g., after login)
  watch(() => authStore.user?.id, (newUserId) => {
    if (newUserId && (authStore.token?.value || localStorage.getItem('token')) && !socket?.connected) {
      connectSocket();
    }
  });
  
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.notification-container {
  position: relative;
}

.notification-btn {
  position: relative;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.notification-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.notification-btn.has-unread {
  animation: pulse 2s infinite;
}

.badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #ff4444;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.notification-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 350px;
  max-height: 500px;
  overflow: hidden;
  z-index: 1000;
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}

.notification-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.mark-all-btn {
  background: none;
  border: none;
  color: #0066cc;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}

.mark-all-btn:hover:not(:disabled) {
  background-color: #f0f0f0;
}

.mark-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading,
.empty-state {
  padding: 20px;
  text-align: center;
  color: #666;
}

.notification-list {
  max-height: 400px;
  overflow-y: auto;
}

.notification-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background-color 0.2s;
}

.notification-item:hover {
  background-color: #f9f9f9;
}

.notification-item.unread {
  background-color: #f0f8ff;
  font-weight: 500;
}

.notification-content {
  flex: 1;
}

.notification-message {
  margin: 0 0 4px 0;
  font-size: 14px;
  line-height: 1.4;
}

.notification-time {
  font-size: 12px;
  color: #999;
}

.mark-read-btn {
  background: none;
  border: none;
  color: #0066cc;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 4px;
  opacity: 0.6;
}

.mark-read-btn:hover {
  opacity: 1;
  background-color: rgba(0, 102, 204, 0.1);
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>

