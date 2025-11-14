import { IsString, IsOptional, IsEnum, IsMongoId, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMessageDto {
  @IsMongoId()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  chatId?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  content?: string;

  @IsEnum(['text', 'image', 'file', 'voice', 'sticker', 'emoji'])
  @IsOptional()
  type?: 'text' | 'image' | 'file' | 'voice' | 'sticker' | 'emoji';

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  replyToId?: string;

  // File reference (when file is uploaded separately)
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  fileUrl?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  fileName?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : Number(value)))
  fileSize?: number;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  mimeType?: string;
}

