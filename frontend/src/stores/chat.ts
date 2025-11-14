import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { chatService, Chat, Message } from '../services/chat';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth';

export const useChatStore = defineStore('chat', () => {
  const authStore = useAuthStore();
  
  const chats = ref<Chat[]>([]);
  const activeChatId = ref<string | null>(null);
  const messages = ref<Map<string, Message[]>>(new Map());
  const loading = ref(false);
  const socket = ref<Socket | null>(null);
  const typingUsers = ref<Map<string, string[]>>(new Map());

  const activeChat = computed(() => {
    if (!activeChatId.value) return null;
    return chats.value.find(c => c._id === activeChatId.value) || null;
  });

  const activeMessages = computed(() => {
    if (!activeChatId.value) return [];
    return messages.value.get(activeChatId.value) || [];
  });

  const unreadCounts = computed(() => {
    const counts = new Map<string, number>();
    chats.value.forEach(chat => {
      // Use backend unreadCount if available, otherwise fallback to local calculation
      if (chat.unreadCount !== undefined && chat.unreadCount > 0) {
        counts.set(chat._id, chat.unreadCount);
      } else {
        // Fallback: calculate from loaded messages
        const chatMessages = messages.value.get(chat._id) || [];
        const unread = chatMessages.filter(m => !m.read && m.senderId !== authStore.user?.id).length;
        if (unread > 0) {
          counts.set(chat._id, unread);
        }
      }
    });
    return counts;
  });

  function connectSocket() {
    if (socket.value?.connected) return;

    const token = localStorage.getItem('token') || authStore.token;
    if (!token) return;

    socket.value = io(`${import.meta.env.VITE_API_URL || 'http://localhost'}/chat`, {
      auth: { token },
      query: { token },
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    socket.value.on('connect', () => {
      console.log('Chat socket connected');
    });

    socket.value.on('disconnect', () => {
      console.log('Chat socket disconnected');
    });

    socket.value.on('message:new', (message: Message) => {
      addMessage(message.chatId, message);
      // Only mark as read if this is the active chat and message is not from current user
      if (message.chatId === activeChatId.value && message.senderId !== authStore.user?.id) {
        markAsRead(message.chatId);
      } else if (message.senderId !== authStore.user?.id) {
        // Update unread count for non-active chats
        const chat = chats.value.find(c => c._id === message.chatId);
        if (chat) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        }
      }
    });

    socket.value.on('message:updated', (message: Message) => {
      updateMessage(message.chatId, message);
    });

    socket.value.on('message:reaction', (data: { messageId: string; message: Message }) => {
      const chatMessages = Array.from(messages.value.values()).flat();
      const msg = chatMessages.find(m => m._id === data.messageId);
      if (msg) {
        updateMessage(msg.chatId, data.message);
      }
    });

    socket.value.on('message:deleted', (data: { messageId: string }) => {
      if (activeChatId.value) {
        removeMessage(activeChatId.value, data.messageId);
      }
    });

    socket.value.on('group:updated', (chat: Chat) => {
      updateChat(chat);
    });

    socket.value.on('typing:update', (data: { chatId: string; userIds: string[] }) => {
      // Filter out current user from typing indicators
      const filteredUserIds = data.userIds.filter(id => id !== authStore.user?.id);
      typingUsers.value.set(data.chatId, filteredUserIds);
    });

    socket.value.on('error', (error: { message: string }) => {
      console.error('Chat socket error:', error);
    });
  }

  function disconnectSocket() {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  }

  async function fetchChats() {
    loading.value = true;
    try {
      chats.value = await chatService.getChats();
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMessages(chatId: string, limit: number = 50, offset: number = 0) {
    try {
      const fetchedMessages = await chatService.getMessages(chatId, limit, offset);
      const existing = messages.value.get(chatId) || [];
      
      // If offset is 0, we're fetching initial messages - replace existing
      if (offset === 0) {
        messages.value.set(chatId, fetchedMessages.reverse());
      } else {
        // Otherwise, we're loading more - append only new messages
        const existingIds = new Set(existing.map(m => m._id));
        const newMessages = fetchedMessages.reverse().filter(m => !existingIds.has(m._id));
        messages.value.set(chatId, [...newMessages, ...existing]);
      }
      
      return fetchedMessages;
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      throw error;
    }
  }

  async function createDirectChat(userId: string) {
    try {
      const chat = await chatService.createDirectChat(userId);
      chats.value.unshift(chat);
      return chat;
    } catch (error) {
      console.error('Failed to create direct chat:', error);
      throw error;
    }
  }

  async function createGroupChat(name: string, participantIds: string[]) {
    try {
      const chat = await chatService.createGroupChat(name, participantIds);
      chats.value.unshift(chat);
      return chat;
    } catch (error) {
      console.error('Failed to create group chat:', error);
      throw error;
    }
  }

  async function sendMessage(
    chatId: string, 
    content: string, 
    type: string = 'text', 
    replyToId?: string, 
    file?: File,
    fileUrl?: string,
    fileName?: string,
    fileSize?: number,
    mimeType?: string
  ) {
    try {
      const message = await chatService.sendMessage(
        chatId, 
        content, 
        type, 
        replyToId, 
        file,
        fileUrl,
        fileName,
        fileSize,
        mimeType
      );
      // Don't add message here - it will be added via WebSocket broadcast from backend
      // Only add immediately if WebSocket is not connected (fallback)
      if (!socket.value?.connected) {
        addMessage(chatId, message);
      }
      // Don't emit via WebSocket - backend already broadcasts the message after HTTP creation
      
      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  function addMessage(chatId: string, message: Message) {
    const chatMessages = messages.value.get(chatId) || [];
    if (!chatMessages.find(m => m._id === message._id)) {
      chatMessages.push(message);
      messages.value.set(chatId, chatMessages);
      
      const chat = chats.value.find(c => c._id === chatId);
      if (chat) {
        chat.lastMessageId = message._id;
        chat.lastMessageAt = message.createdAt;
        chats.value.sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        });
      }
    }
  }

  function updateMessage(chatId: string, message: Message) {
    const chatMessages = messages.value.get(chatId) || [];
    const index = chatMessages.findIndex(m => m._id === message._id);
    if (index !== -1) {
      chatMessages[index] = message;
      messages.value.set(chatId, chatMessages);
    }
  }

  function removeMessage(chatId: string, messageId: string) {
    const chatMessages = messages.value.get(chatId) || [];
    const filtered = chatMessages.filter(m => m._id !== messageId);
    messages.value.set(chatId, filtered);
  }

  function updateChat(chat: Chat) {
    const index = chats.value.findIndex(c => c._id === chat._id);
    if (index !== -1) {
      // Preserve unreadCount if not provided in update
      if (chat.unreadCount === undefined) {
        chat.unreadCount = chats.value[index].unreadCount;
      }
      chats.value[index] = chat;
    } else {
      chats.value.unshift(chat);
    }
  }

  function setActiveChat(chatId: string | null) {
    activeChatId.value = chatId;
    if (chatId && socket.value?.connected) {
      socket.value.emit('join:chat', { chatId });
      markAsRead(chatId);
    }
  }

  async function markAsRead(chatId: string) {
    try {
      await chatService.markAsRead(chatId);
      const chatMessages = messages.value.get(chatId) || [];
      chatMessages.forEach(m => {
        if (m.senderId !== authStore.user?.id) {
          m.read = true;
        }
      });
      messages.value.set(chatId, chatMessages);
      
      // Update unread count in chat object
      const chat = chats.value.find(c => c._id === chatId);
      if (chat) {
        chat.unreadCount = 0;
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  function startTyping(chatId: string) {
    if (socket.value?.connected) {
      socket.value.emit('typing:start', { chatId });
    }
  }

  function stopTyping(chatId: string) {
    if (socket.value?.connected) {
      socket.value.emit('typing:stop', { chatId });
    }
  }

  function leaveChat(chatId: string) {
    if (socket.value?.connected) {
      socket.value.emit('leave:chat', { chatId });
    }
    messages.value.delete(chatId);
    chats.value = chats.value.filter(c => c._id !== chatId);
    if (activeChatId.value === chatId) {
      activeChatId.value = null;
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    try {
      const chatMessages = Array.from(messages.value.values()).flat();
      const message = chatMessages.find((m: any) => m._id === messageId);
      if (!message) return;

      const hasReaction = message.reactions?.[emoji]?.includes(authStore.user?.id || '');
      
      const updatedMessage = hasReaction
        ? await chatService.removeReaction(messageId, emoji)
        : await chatService.addReaction(messageId, emoji);
      
      if (message.chatId) {
        updateMessage(message.chatId, updatedMessage);
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
      throw error;
    }
  }

  return {
    chats,
    activeChatId,
    activeChat,
    activeMessages,
    messages,
    loading,
    socket,
    typingUsers,
    unreadCounts,
    connectSocket,
    disconnectSocket,
    fetchChats,
    fetchMessages,
    createDirectChat,
    createGroupChat,
    sendMessage,
    setActiveChat,
    markAsRead,
    startTyping,
    stopTyping,
    leaveChat,
    toggleReaction,
  };
});

