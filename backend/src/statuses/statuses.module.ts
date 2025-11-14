import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatusesController } from './statuses.controller';
import { StatusesService } from './statuses.service';
import { TaskStatus } from '../entities/task-status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TaskStatus])],
  controllers: [StatusesController],
  providers: [StatusesService],
  exports: [StatusesService],
})
export class StatusesModule {}



