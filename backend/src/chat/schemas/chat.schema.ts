import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  @Prop({ required: true, enum: ['direct', 'group'], default: 'direct' })
  type: 'direct' | 'group';

  @Prop()
  name: string;

  @Prop({ type: [{ type: String }], required: true })
  participants: string[];

  @Prop({ type: String })
  adminId: string;

  @Prop({ type: [{ type: String }], default: [] })
  admins: string[];

  @Prop({ type: String })
  lastMessageId: string;

  @Prop()
  lastMessageAt: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);

ChatSchema.index({ type: 1 });
ChatSchema.index({ participants: 1 });
ChatSchema.index({ lastMessageAt: -1 });

