import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsGateway } from './notifications.gateway';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { Task } from '../entities/task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, Task]),
    BullModule.registerQueue({
      name: 'notifications',
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
    }),
  ],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    NotificationsGateway,
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService, BullModule],
})
export class NotificationsModule {}
