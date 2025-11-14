import api from './api';

export interface Chat {
  _id: string;
  type: 'direct' | 'group';
  name?: string;
  participants: User[];
  admin?: User;
  admins?: User[];
  lastMessageId?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  chatId: string;
  senderId: string;
  sender?: User;
  content?: string;
  type: 'text' | 'image' | 'file' | 'voice' | 'sticker' | 'emoji';
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  read: boolean;
  readAt?: string;
  editedAt?: string;
  replyToId?: string;
  replyTo?: Message;
  reactions?: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export const chatService = {
  async getChats(): Promise<Chat[]> {
    const response = await api.get('/chats');
    return response.data;
  },

  async getChat(chatId: string): Promise<Chat> {
    const response = await api.get(`/chats/${chatId}`);
    return response.data;
  },

  async getMessages(chatId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
    const response = await api.get(`/chats/${chatId}/messages`, {
      params: { limit, offset },
    });
    return response.data;
  },

  async createDirectChat(userId: string): Promise<Chat> {
    const response = await api.post(`/chats/direct/${userId}`);
    return response.data;
  },

  async createGroupChat(name: string, participantIds: string[]): Promise<Chat> {
    const response = await api.post('/chats/group', {
      type: 'group',
      name,
      participantIds,
    });
    return response.data;
  },

  async updateGroup(chatId: string, data: {
    name?: string;
    addParticipants?: string[];
    removeParticipants?: string[];
    addAdmins?: string[];
    removeAdmins?: string[];
  }): Promise<Chat> {
    const response = await api.put(`/chats/group/${chatId}`, data);
    return response.data;
  },

  async transferAdmin(chatId: string, newAdminId: string): Promise<Chat> {
    const response = await api.post(`/chats/group/${chatId}/transfer-admin/${newAdminId}`);
    return response.data;
  },

  async leaveGroup(chatId: string): Promise<void> {
    await api.post(`/chats/group/${chatId}/leave`);
  },

  async sendMessage(
    chatId: string, 
    content: string, 
    type: string = 'text', 
    replyToId?: string, 
    file?: File,
    fileUrl?: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string
  ): Promise<Message> {
    // If fileUrl is provided, use it (file was uploaded separately)
    if (fileUrl) {
      const response = await api.post(`/chats/${chatId}/messages`, {
        content,
        type,
        replyToId,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
      });
      return response.data;
    }

    // Otherwise, upload file directly (backward compatibility)
    const formData = new FormData();
    formData.append('content', content);
    formData.append('type', type);
    if (replyToId) {
      formData.append('replyToId', replyToId);
    }
    if (file) {
      formData.append('file', file);
    }

    const response = await api.post(`/chats/${chatId}/messages`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async updateMessage(messageId: string, content: string): Promise<Message> {
    const response = await api.put(`/chats/messages/${messageId}`, { content });
    return response.data;
  },

  async deleteMessage(messageId: string): Promise<void> {
    await api.delete(`/chats/messages/${messageId}`);
  },

  async markAsRead(chatId: string): Promise<void> {
    await api.post(`/chats/${chatId}/read`);
  },

  async addReaction(messageId: string, emoji: string): Promise<Message> {
    const response = await api.post(`/chats/messages/${messageId}/reactions`, { emoji });
    return response.data;
  },

  async removeReaction(messageId: string, emoji: string): Promise<Message> {
    const response = await api.delete(`/chats/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
    return response.data;
  },
};

