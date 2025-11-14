import { IsArray, IsUUID, IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateChatDto {
  @IsEnum(['direct', 'group'])
  @IsOptional()
  type?: 'direct' | 'group';

  @IsArray()
  @IsUUID('4', { each: true })
  participantIds: string[];

  @IsString()
  @IsOptional()
  name?: string;
}

