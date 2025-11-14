import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

interface NotificationJobData {
  userId: string;
  taskId: string;
  action: 'created' | 'reassigned';
}

@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private notificationsService: NotificationsService) {}

  @Process('send')
  async handleNotification(job: Job<NotificationJobData>) {
    const { userId, taskId, action } = job.data;
    
    try {
      await this.notificationsService.sendTaskNotification(userId, taskId, action);
    } catch (error) {
      this.logger.error(`Error processing notification job: ${error.message}`, error.stack);
      throw error;
    }
  }
}



