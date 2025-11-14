import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import { User } from '../entities/user.entity';
import { TaskStatus } from '../entities/task-status.entity';
import { UserAvailability } from '../entities/user-availability.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { TasksGateway } from './tasks.gateway';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  private readonly notificationJobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
  };

  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(TaskStatus)
    private statusRepository: Repository<TaskStatus>,
    @InjectRepository(UserAvailability)
    private availabilityRepository: Repository<UserAvailability>,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    private tasksGateway: TasksGateway,
  ) {}

  private ensureDate(date: Date | string): Date {
    return date instanceof Date ? date : new Date(date);
  }

  private async isUserAvailable(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeTaskId: string | null = null,
  ): Promise<boolean> {
    const queryBuilder = this.taskRepository
      .createQueryBuilder('task')
      .where('task.assignedUserId = :userId', { userId })
      .andWhere(
        '(task.startDate <= :endDate AND task.endDate >= :startDate)',
        { startDate, endDate },
      );

    if (excludeTaskId) {
      queryBuilder.andWhere('task.id != :excludeTaskId', { excludeTaskId });
    }

    const overlappingTasks = await queryBuilder.getMany();

    return overlappingTasks.length === 0;
  }

  private async updateAvailability(
    taskId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    action: 'create' | 'update' | 'reassign' | 'delete',
  ) {
    if (action === 'delete') {
      await this.availabilityRepository.delete({ taskId });
      return;
    }

    const existing = await this.availabilityRepository.findOne({
      where: { taskId },
    });

    if (existing) {
      existing.startDate = startDate;
      existing.endDate = endDate;
      existing.userId = userId;
      await this.availabilityRepository.save(existing);
    } else {
      const availability = this.availabilityRepository.create({
        taskId,
        userId,
        startDate,
        endDate,
      });
      await this.availabilityRepository.save(availability);
    }
  }

  async findAll(filters?: {
    statusId?: string;
    assignedUserId?: string;
    search?: string;
  }) {
    const queryBuilder = this.taskRepository.createQueryBuilder('task');

    if (filters?.statusId) {
      queryBuilder.where('task.statusId = :statusId', { statusId: filters.statusId });
    }

    if (filters?.assignedUserId) {
      queryBuilder.andWhere('task.assignedUserId = :assignedUserId', {
        assignedUserId: filters.assignedUserId,
      });
    }

    if (filters?.search) {
      queryBuilder.andWhere(
        '(task.title LIKE :search OR task.description LIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    return queryBuilder
      .leftJoinAndSelect('task.assignedUser', 'assignedUser')
      .leftJoinAndSelect('task.status', 'status')
      .orderBy('task.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string) {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['assignedUser', 'status'],
    });
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    return task;
  }

  async create(createTaskDto: CreateTaskDto) {
    const user = await this.userRepository.findOne({
      where: { id: createTaskDto.assignedUserId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const status = await this.statusRepository.findOne({
      where: { id: createTaskDto.statusId },
    });
    if (!status) {
      throw new NotFoundException('Status not found');
    }

    const startDate = this.ensureDate(createTaskDto.startDate);
    const endDate = this.ensureDate(createTaskDto.endDate);

    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    const isAvailable = await this.isUserAvailable(
      createTaskDto.assignedUserId,
      startDate,
      endDate,
      null,
    );

    if (!isAvailable) {
      throw new BadRequestException('User already has an overlapping task');
    }

    const task = this.taskRepository.create({
      ...createTaskDto,
      startDate,
      endDate,
      assignedUser: user,
      status,
    });

    const savedTask = await this.taskRepository.save(task);

    await this.updateAvailability(
      savedTask.id,
      savedTask.assignedUserId,
      this.ensureDate(savedTask.startDate),
      this.ensureDate(savedTask.endDate),
      'create',
    );

    try {
      await this.notificationsQueue.add('send', {
        userId: savedTask.assignedUserId,
        taskId: savedTask.id,
        action: 'created',
      }, this.notificationJobOptions);
    } catch (error) {
      this.logger.error(`Error adding notification job: ${error.message}`, error.stack);
    }

    this.tasksGateway.broadcastTaskEvent('task:created', savedTask.id);

    return this.findOne(savedTask.id);
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const task = await this.findOne(id);
    let needsAvailabilityCheck = false;
    
    const taskStartDate = this.ensureDate(task.startDate);
    const taskEndDate = this.ensureDate(task.endDate);
    let newStartDate = taskStartDate;
    let newEndDate = taskEndDate;
    let newUserId = task.assignedUserId;

    if (updateTaskDto.startDate || updateTaskDto.endDate || updateTaskDto.assignedUserId) {
      needsAvailabilityCheck = true;
      newStartDate = updateTaskDto.startDate
        ? this.ensureDate(updateTaskDto.startDate)
        : taskStartDate;
      newEndDate = updateTaskDto.endDate ? this.ensureDate(updateTaskDto.endDate) : taskEndDate;
      newUserId = updateTaskDto.assignedUserId || task.assignedUserId;

      if (newStartDate > newEndDate) {
        throw new BadRequestException('Start date must be before end date');
      }

      if (
        newUserId !== task.assignedUserId ||
        newStartDate.getTime() !== taskStartDate.getTime() ||
        newEndDate.getTime() !== taskEndDate.getTime()
      ) {
        const isAvailable = await this.isUserAvailable(
          newUserId,
          newStartDate,
          newEndDate,
          id,
        );

        if (!isAvailable) {
          throw new BadRequestException('User already has an overlapping task');
        }
      }
    }

    if (updateTaskDto.assignedUserId) {
      const user = await this.userRepository.findOne({
        where: { id: updateTaskDto.assignedUserId },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }
      task.assignedUser = user;
      task.assignedUserId = updateTaskDto.assignedUserId;
    }

    if (updateTaskDto.statusId) {
      const status = await this.statusRepository.findOne({
        where: { id: updateTaskDto.statusId },
      });
      if (!status) {
        throw new NotFoundException('Status not found');
      }
      task.status = status;
      task.statusId = updateTaskDto.statusId;
    }

    if (updateTaskDto.title) task.title = updateTaskDto.title;
    if (updateTaskDto.description !== undefined) task.description = updateTaskDto.description;
    if (updateTaskDto.startDate) task.startDate = newStartDate;
    if (updateTaskDto.endDate) task.endDate = newEndDate;

    const oldAssignedUserId = task.assignedUserId;
    const savedTask = await this.taskRepository.save(task);
    const userChanged = updateTaskDto.assignedUserId && updateTaskDto.assignedUserId !== oldAssignedUserId;

    if (needsAvailabilityCheck) {
      await this.updateAvailability(
        savedTask.id,
        savedTask.assignedUserId,
        this.ensureDate(savedTask.startDate),
        this.ensureDate(savedTask.endDate),
        'update',
      );
    }

    if (userChanged) {
      await this.notificationsQueue.add('send', {
        userId: savedTask.assignedUserId,
        taskId: savedTask.id,
        action: 'reassigned',
      }, this.notificationJobOptions);
    }

    this.tasksGateway.broadcastTaskEvent('task:updated', savedTask.id);

    return this.findOne(savedTask.id);
  }

  async reassign(id: string, reassignTaskDto: ReassignTaskDto) {
    const task = await this.findOne(id);

    if (task.assignedUserId === reassignTaskDto.assignedUserId) {
      return task;
    }

    const user = await this.userRepository.findOne({
      where: { id: reassignTaskDto.assignedUserId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const startDate = this.ensureDate(task.startDate);
    const endDate = this.ensureDate(task.endDate);
    
    const isAvailable = await this.isUserAvailable(
      reassignTaskDto.assignedUserId,
      startDate,
      endDate,
      id,
    );

    if (!isAvailable) {
      throw new BadRequestException('User already has an overlapping task');
    }

    task.assignedUser = user;
    task.assignedUserId = reassignTaskDto.assignedUserId;

    const savedTask = await this.taskRepository.save(task);

    await this.updateAvailability(
      savedTask.id,
      savedTask.assignedUserId,
      this.ensureDate(savedTask.startDate),
      this.ensureDate(savedTask.endDate),
      'reassign',
    );

    await this.notificationsQueue.add('send', {
      userId: savedTask.assignedUserId,
      taskId: savedTask.id,
      action: 'reassigned',
    }, this.notificationJobOptions);

    this.tasksGateway.broadcastTaskEvent('task:reassigned', savedTask.id);

    return this.findOne(savedTask.id);
  }

  async remove(id: string) {
    const task = await this.findOne(id);
    
    await this.taskRepository.remove(task);

    await this.updateAvailability(
      id,
      task.assignedUserId,
      this.ensureDate(task.startDate),
      this.ensureDate(task.endDate),
      'delete',
    );

    this.tasksGateway.broadcastTaskEvent('task:deleted', id);

    return { message: 'Task deleted successfully' };
  }
}
