import { IsString, IsNotEmpty, IsUUID, IsDateString, IsOptional, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  title: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsUUID()
  @IsNotEmpty()
  assignedUserId: string;

  @IsUUID()
  @IsNotEmpty()
  statusId: string;
}

