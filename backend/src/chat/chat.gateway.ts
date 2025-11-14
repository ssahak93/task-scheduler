import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
  path: '/socket.io/',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Socket>();
  private typingUsers = new Map<string, Set<string>>();

  constructor(
    private jwtService: JwtService,
    private chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.token || client.handshake.auth?.token;

      if (!token || typeof token !== 'string') {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.id;

      if (!userId) {
        client.disconnect();
        return;
      }

      this.userSockets.set(userId, client);
      client.data.userId = userId;

      client.join(`user:${userId}`);
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.userSockets.delete(userId);
      this.typingUsers.forEach((users, chatId) => {
        users.delete(userId);
        if (users.size === 0) {
          this.typingUsers.delete(chatId);
        }
      });
    }
  }

  @SubscribeMessage('join:chat')
  handleJoinChat(@ConnectedSocket() client: Socket, @MessageBody() data: { chatId: string }) {
    client.join(`chat:${data.chatId}`);
  }

  @SubscribeMessage('leave:chat')
  handleLeaveChat(@ConnectedSocket() client: Socket, @MessageBody() data: { chatId: string }) {
    client.leave(`chat:${data.chatId}`);
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() createMessageDto: CreateMessageDto,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const message = await this.chatService.createMessage(userId, createMessageDto);
      this.broadcastMessage(message.chatId, message);
      return { success: true, message };
    } catch (error) {
      client.emit('error', { message: error.message || 'Failed to send message' });
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    if (!this.typingUsers.has(data.chatId)) {
      this.typingUsers.set(data.chatId, new Set());
    }
    this.typingUsers.get(data.chatId)!.add(userId);

    const typingUserIds = Array.from(this.typingUsers.get(data.chatId)!);
    
    // Broadcast to ALL users in the chat room (frontend will filter out current user)
    this.server.to(`chat:${data.chatId}`).emit('typing:update', {
      chatId: data.chatId,
      userIds: typingUserIds,
    });
    
    // Also send to the sender so they can see other users typing (they'll filter themselves out on frontend)
    client.emit('typing:update', {
      chatId: data.chatId,
      userIds: typingUserIds,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    const users = this.typingUsers.get(data.chatId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) {
        this.typingUsers.delete(data.chatId);
      }
    }

    const remainingUserIds = users ? Array.from(users) : [];
    
    // Broadcast to ALL users in the chat room (frontend will filter out current user)
    this.server.to(`chat:${data.chatId}`).emit('typing:update', {
      chatId: data.chatId,
      userIds: remainingUserIds,
    });
    
    // Also send to the sender so they can see other users typing (they'll filter themselves out on frontend)
    client.emit('typing:update', {
      chatId: data.chatId,
      userIds: remainingUserIds,
    });
  }

  broadcastMessage(chatId: string, message: any) {
    this.server.to(`chat:${chatId}`).emit('message:new', message);
  }

  broadcastMessageUpdate(chatId: string, message: any) {
    this.server.to(`chat:${chatId}`).emit('message:updated', message);
  }

  broadcastMessageDelete(chatId: string, messageId: string) {
    this.server.to(`chat:${chatId}`).emit('message:deleted', { messageId });
  }

  broadcastGroupUpdate(chatId: string, chat: any) {
    this.server.to(`chat:${chatId}`).emit('group:updated', chat);
  }
}

