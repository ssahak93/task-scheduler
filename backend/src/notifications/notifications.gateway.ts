import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { OnApplicationBootstrap, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { Notification } from '../entities/notification.entity';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/notifications',
  path: '/socket.io/',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnApplicationBootstrap {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets = new Map<string, Socket>();

  constructor(
    private notificationsService: NotificationsService,
    private jwtService: JwtService,
  ) {}

  onApplicationBootstrap() {
    this.notificationsService.setNotificationEmitter((notification: Notification) => {
      this.sendNotification(notification);
    }, 'NotificationsGateway');
  }

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

      const notifications = await this.notificationsService.getUserNotifications(userId, true);
      const formattedNotifications = notifications.map(n => ({
        id: n.id,
        userId: n.userId,
        taskId: n.taskId,
        type: n.type,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }));
      client.emit('notifications', formattedNotifications);
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.userSockets.delete(userId);
    }
  }

  private sendNotification(notification: Notification) {
    const socket = this.userSockets.get(notification.userId);
    
    if (socket && socket.connected) {
      const notificationData = {
        id: notification.id,
        userId: notification.userId,
        taskId: notification.taskId,
        type: notification.type,
        message: notification.message,
        read: notification.read,
        createdAt: notification.createdAt.toISOString(),
      };
      socket.emit('notification', notificationData);
    }
  }
}

