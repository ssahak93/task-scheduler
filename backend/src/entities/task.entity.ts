import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { TaskStatus } from './task-status.entity';

@Entity('tasks')
@Index(['title'])
@Index(['startDate', 'endDate'])
@Index(['assignedUserId'])
@Index(['statusId'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ name: 'assigned_user_id', type: 'varchar', length: '36' })
  assignedUserId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser: User;

  @Column({ name: 'status_id', type: 'varchar', length: '36' })
  statusId: string;

  @ManyToOne(() => TaskStatus, { eager: true })
  @JoinColumn({ name: 'status_id' })
  status: TaskStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

