import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/tasks',
  path: '/socket.io/',
})
export class TasksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Set<Socket>();

  constructor(private jwtService: JwtService) {}

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

      this.connectedClients.add(client);
      client.data.userId = userId;
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (this.connectedClients.has(client)) {
      this.connectedClients.delete(client);
    }
  }

  broadcastTaskEvent(event: 'task:created' | 'task:updated' | 'task:reassigned' | 'task:deleted', taskId: string) {
    this.server.emit(event, { taskId });
  }
}

