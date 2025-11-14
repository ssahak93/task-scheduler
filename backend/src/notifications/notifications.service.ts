import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { Task } from '../entities/task.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private notificationEmitter?: (notification: Notification) => void;
  private emitterSetBy?: string;

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
  ) {}

  setNotificationEmitter(emitter: (notification: Notification) => void, setBy?: string) {
    this.notificationEmitter = emitter;
    this.emitterSetBy = setBy;
  }

  async createNotification(
    userId: string,
    taskId: string | null,
    type: string,
    message: string,
  ) {
    const notification = this.notificationRepository.create({
      userId,
      taskId,
      type,
      message,
      read: false,
    });
    const savedNotification = await this.notificationRepository.save(notification);
    
    if (this.notificationEmitter) {
      try {
        this.notificationEmitter(savedNotification);
      } catch (error) {
        this.logger.error(`Error calling notification emitter: ${error.message}`, error.stack);
        throw error;
      }
    }
    
    return savedNotification;
  }

  async getUserNotifications(userId: string, unreadOnly: boolean = false) {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.task', 'task')
      .leftJoinAndSelect('task.assignedUser', 'assignedUser')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC');

    if (unreadOnly) {
      queryBuilder.andWhere('notification.read = :read', { read: false });
    }

    return await queryBuilder.getMany();
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return null;
    }

    notification.read = true;
    return await this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string) {
    await this.notificationRepository.update(
      { userId, read: false },
      { read: true },
    );
    return { message: 'All notifications marked as read' };
  }

  async sendTaskNotification(
    userId: string,
    taskId: string,
    action: 'created' | 'reassigned',
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      relations: ['status'],
    });

    if (!user || !task) {
      return;
    }

    let message = '';
    let type = '';

    if (action === 'created') {
      type = 'task_assigned';
      message = `A new task "${task.title}" has been assigned to you.`;
    } else if (action === 'reassigned') {
      type = 'task_reassigned';
      message = `The task "${task.title}" has been reassigned to you.`;
    }

    await this.createNotification(userId, taskId, type, message);
  }
}
