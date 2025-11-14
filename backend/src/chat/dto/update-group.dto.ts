import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class UpdateGroupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  addParticipants?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  removeParticipants?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  addAdmins?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  removeAdmins?: string[];
}

