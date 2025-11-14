import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: String, required: true, index: true })
  chatId: string;

  @Prop({ type: String, required: true })
  senderId: string;

  @Prop()
  content: string;

  @Prop({ required: true, enum: ['text', 'image', 'file', 'voice', 'sticker', 'emoji'], default: 'text' })
  type: 'text' | 'image' | 'file' | 'voice' | 'sticker' | 'emoji';

  @Prop()
  fileName: string;

  @Prop()
  fileUrl: string;

  @Prop()
  fileSize: number;

  @Prop()
  mimeType: string;

  @Prop({ default: false })
  read: boolean;

  @Prop()
  readAt: Date;

  @Prop()
  editedAt: Date;

  @Prop({ type: String })
  replyToId: string;

  @Prop({ type: Map, of: [String], default: {} })
  reactions: Map<string, string[]>; // emoji -> array of user IDs

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ chatId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });

