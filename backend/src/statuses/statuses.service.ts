import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskStatus } from '../entities/task-status.entity';

@Injectable()
export class StatusesService {
  constructor(
    @InjectRepository(TaskStatus)
    private statusRepository: Repository<TaskStatus>,
  ) {}

  async findAll() {
    return this.statusRepository.find();
  }
}


