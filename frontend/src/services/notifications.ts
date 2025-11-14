import api from './api';

export interface Notification {
  id: string;
  userId: string;
  taskId: string | null;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  task?: {
    id: string;
    title: string;
  };
}

export async function fetchNotifications(unreadOnly: boolean = false): Promise<Notification[]> {
  const response = await api.get(`/notifications${unreadOnly ? '?unread=true' : ''}`);
  return response.data;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await api.patch(`/notifications/${notificationId}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}

