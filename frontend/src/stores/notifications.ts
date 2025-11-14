import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { fetchNotifications, markAsRead, markAllAsRead } from '../services/notifications';
import type { Notification } from '../services/notifications';

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const unreadCount = computed(() => {
    return notifications.value.filter((n: Notification) => !n.read).length;
  });

  const unreadNotifications = computed(() => {
    return notifications.value.filter((n: Notification) => !n.read);
  });

  async function loadNotifications(unreadOnly: boolean = false) {
    loading.value = true;
    error.value = null;
    try {
      notifications.value = await fetchNotifications(unreadOnly);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to fetch notifications';
      console.error('Failed to load notifications:', err);
    } finally {
      loading.value = false;
    }
  }

  async function markNotificationAsRead(notificationId: string) {
    try {
      await markAsRead(notificationId);
      const notification = notifications.value.find((n) => n.id === notificationId);
      if (notification) {
        notification.read = true;
      }
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  }

  async function markAllNotificationsAsRead() {
    try {
      await markAllAsRead();
      notifications.value.forEach((n: Notification) => {
        n.read = true;
      });
    } catch (err: any) {
      console.error('Failed to mark all notifications as read:', err);
      throw err;
    }
  }

  function addNotification(notification: Notification) {
    // Check if notification already exists (avoid duplicates)
    const exists = notifications.value.find((n) => n.id === notification.id);
    if (exists) {
      // Update existing notification
      const index = notifications.value.indexOf(exists);
      notifications.value[index] = notification;
    } else {
      // Add new notification at the beginning
      notifications.value.unshift(notification);
    }
  }

  return {
    notifications,
    loading,
    error,
    unreadCount,
    unreadNotifications,
    loadNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    addNotification,
  };
});

