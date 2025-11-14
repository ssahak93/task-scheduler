import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksGateway } from './tasks.gateway';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { TaskStatus } from '../entities/task-status.entity';
import { UserAvailability } from '../entities/user-availability.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, User, TaskStatus, UserAvailability]),
    NotificationsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksGateway],
  exports: [TasksService],
})
export class TasksModule {}
