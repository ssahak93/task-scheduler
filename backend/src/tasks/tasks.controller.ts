import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ReassignTaskDto } from './dto/reassign-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(
    @Query('statusId') statusId?: string,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('search') search?: string,
  ) {
    const filters: any = {};
    if (statusId) filters.statusId = statusId;
    if (assignedUserId) filters.assignedUserId = assignedUserId;
    if (search) filters.search = search;
    return this.tasksService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Patch(':id/reassign')
  reassign(@Param('id') id: string, @Body() reassignTaskDto: ReassignTaskDto) {
    return this.tasksService.reassign(id, reassignTaskDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(id, updateTaskDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}

