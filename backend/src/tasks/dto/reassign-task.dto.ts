import { IsUUID, IsNotEmpty } from 'class-validator';

export class ReassignTaskDto {
  @IsUUID()
  @IsNotEmpty()
  assignedUserId: string;
}

