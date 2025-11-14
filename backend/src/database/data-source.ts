import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';
import { User } from '../entities/user.entity';
import { Task } from '../entities/task.entity';
import { TaskStatus } from '../entities/task-status.entity';
import { UserAvailability } from '../entities/user-availability.entity';
import { Notification } from '../entities/notification.entity';

config({ path: path.resolve(__dirname, '../../../.env') });

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [User, Task, TaskStatus, UserAvailability, Notification],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});

