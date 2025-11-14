import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './schemas/chat.schema';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateChatDto } from './dto/create-chat.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private storageService: StorageService,
  ) {}

  async findOrCreateDirectChat(userId1: string, userId2: string): Promise<any> {
    if (userId1 === userId2) {
      throw new BadRequestException('Cannot create chat with yourself');
    }

    const existingChat = await this.chatModel.findOne({
      type: 'direct',
      participants: { $all: [userId1, userId2], $size: 2 },
    }).exec();

    if (existingChat) {
      return await this.enrichChatWithUsers(existingChat, userId1);
    }

    const [user1, user2] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId1 } }),
      this.userRepository.findOne({ where: { id: userId2 } }),
    ]);

    if (!user1 || !user2) {
      throw new NotFoundException('User not found');
    }

    const chat = new this.chatModel({
      type: 'direct',
      participants: [userId1, userId2],
    });

    const savedChat = await chat.save();
    return await this.enrichChatWithUsers(savedChat);
  }

  private async enrichChatWithUsers(chat: ChatDocument, userId?: string): Promise<any> {
    const participantUsers = chat.participants.length > 0
      ? await this.userRepository.find({
          where: { id: In(chat.participants) },
          select: ['id', 'name', 'email'],
        })
      : [];

    const adminUser = chat.adminId
      ? await this.userRepository.findOne({
          where: { id: chat.adminId },
          select: ['id', 'name', 'email'],
        })
      : null;

    const adminUsers =
      chat.admins && chat.admins.length > 0
        ? await this.userRepository.find({
            where: { id: In(chat.admins) },
            select: ['id', 'name', 'email'],
          })
        : [];

    // Calculate unread count for the user
    let unreadCount = 0;
    if (userId) {
      const chatId = String(chat._id);
      unreadCount = await this.messageModel.countDocuments({
        chatId,
        senderId: { $ne: userId },
        read: false,
      }).exec();
    }

    return {
      ...chat.toObject(),
      participants: participantUsers,
      admin: adminUser,
      admins: adminUsers,
      unreadCount,
    };
  }

  async createGroupChat(userId: string, createChatDto: CreateChatDto): Promise<any> {
    if (createChatDto.type !== 'group') {
      throw new BadRequestException('This endpoint is for group chats only');
    }

    if (!createChatDto.name) {
      throw new BadRequestException('Group name is required');
    }

    if (createChatDto.participantIds.length < 2) {
      throw new BadRequestException('Group must have at least 2 participants');
    }

    const participantIds = [userId, ...createChatDto.participantIds];
    const uniqueParticipants = Array.from(new Set(participantIds));

    const chat = new this.chatModel({
      type: 'group',
      name: createChatDto.name,
      participants: uniqueParticipants,
      adminId: userId,
      admins: [userId],
    });

    const savedChat = await chat.save();
    return await this.enrichChatWithUsers(savedChat, userId);
  }

  async getUserChats(userId: string): Promise<any[]> {
    const chats = await this.chatModel
      .find({ participants: userId })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .exec();

    return Promise.all(chats.map(chat => this.enrichChatWithUsers(chat, userId)));
  }

  async getChatById(chatId: string, userId: string): Promise<any> {
    const chat = await this.chatModel
      .findOne({ _id: new Types.ObjectId(chatId), participants: userId })
      .exec();

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    return await this.enrichChatWithUsers(chat, userId);
  }

  async getChatMessages(chatId: string, userId: string, limit: number = 50, offset: number = 0): Promise<any[]> {
    await this.getChatById(chatId, userId);

    const messages = await this.messageModel
      .find({ chatId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .exec();

    return Promise.all(messages.map(async (msg) => {
      const sender = await this.userRepository.findOne({
        where: { id: msg.senderId },
        select: ['id', 'name', 'email'],
      });

      let replyTo: any = null;
      if (msg.replyToId) {
        const replyMsg = await this.messageModel.findById(msg.replyToId).exec();
        if (replyMsg) {
          const replySender = await this.userRepository.findOne({
            where: { id: replyMsg.senderId },
            select: ['id', 'name', 'email'],
          });
          replyTo = { ...replyMsg.toObject(), sender: replySender };
        }
      }

      const reactions = msg.reactions ? Object.fromEntries(msg.reactions) : {};

      return {
        ...msg.toObject(),
        sender,
        replyTo,
        reactions,
      };
    }));
  }

  async createMessage(
    userId: string,
    createMessageDto: CreateMessageDto,
    file?: Express.Multer.File,
  ): Promise<any> {
    const chatId = createMessageDto.chatId;
    if (!chatId) {
      throw new BadRequestException('Chat ID is required');
    }

    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat || !chat.participants.includes(userId)) {
      throw new NotFoundException('Chat not found');
    }

    const messageData: any = {
      chatId: chatId,
      senderId: userId,
      type: createMessageDto.type || 'text',
      content: createMessageDto.content,
    };

    if (createMessageDto.replyToId) {
      messageData.replyToId = createMessageDto.replyToId;
    }

    // Handle file upload - either direct file or fileUrl reference
    if (file) {
      // Direct file upload (backward compatibility)
      const fileName = await this.storageService.uploadFile(file, 'chat');
      const fileUrl = await this.storageService.getFileUrl(fileName);
      
      messageData.fileName = file.originalname;
      messageData.fileUrl = fileUrl;
      messageData.fileSize = file.size;
      messageData.mimeType = file.mimetype;

      if (file.mimetype.startsWith('image/')) {
        messageData.type = 'image';
      } else if (file.mimetype.startsWith('audio/')) {
        messageData.type = 'voice';
      } else {
        messageData.type = 'file';
      }
    } else if (createMessageDto.fileUrl) {
      // File reference (file uploaded separately)
      messageData.fileName = createMessageDto.fileName || 'file';
      messageData.fileUrl = createMessageDto.fileUrl;
      messageData.fileSize = createMessageDto.fileSize;
      messageData.mimeType = createMessageDto.mimeType;

      // Determine type from mimeType or use provided type
      if (createMessageDto.mimeType) {
        if (createMessageDto.mimeType.startsWith('image/')) {
          messageData.type = 'image';
        } else if (createMessageDto.mimeType.startsWith('audio/')) {
          messageData.type = 'voice';
        } else {
          messageData.type = createMessageDto.type || 'file';
        }
      } else {
        messageData.type = createMessageDto.type || 'file';
      }
    }

    const message = new this.messageModel(messageData);
    const savedMessage = await message.save();

    chat.lastMessageId = (savedMessage._id as any).toString();
    chat.lastMessageAt = new Date();
    await chat.save();

    const sender = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email'],
    });

    let replyTo: any = null;
    if (savedMessage.replyToId) {
      const replyMsg = await this.messageModel.findById(savedMessage.replyToId).exec();
      if (replyMsg) {
        const replySender = await this.userRepository.findOne({
          where: { id: replyMsg.senderId },
          select: ['id', 'name', 'email'],
        });
        replyTo = { ...replyMsg.toObject(), sender: replySender };
      }
    }

    const reactions = savedMessage.reactions ? Object.fromEntries(savedMessage.reactions) : {};

    return {
      ...savedMessage.toObject(),
      sender,
      replyTo,
      reactions,
    };
  }

  async markMessagesAsRead(chatId: string, userId: string): Promise<void> {
    await this.messageModel.updateMany(
      {
        chatId,
        senderId: { $ne: userId },
        read: false,
      },
      {
        read: true,
        readAt: new Date(),
      },
    ).exec();
  }

  async updateMessage(messageId: string, userId: string, content: string): Promise<any> {
    const message = await this.messageModel.findOne({
      _id: new Types.ObjectId(messageId),
      senderId: userId,
    }).exec();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    message.content = content;
    message.editedAt = new Date();
    const saved = await message.save();

    const sender = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'name', 'email'],
    });

    const reactions = saved.reactions ? Object.fromEntries(saved.reactions) : {};

    return {
      ...saved.toObject(),
      sender,
      reactions,
    };
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageModel.findOne({
      _id: new Types.ObjectId(messageId),
      senderId: userId,
    }).exec();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.messageModel.deleteOne({ _id: message._id }).exec();
  }

  async addReaction(messageId: string, userId: string, emoji: string): Promise<any> {
    const message = await this.messageModel.findById(new Types.ObjectId(messageId)).exec();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (!message.reactions) {
      message.reactions = new Map();
    }

    const reactionUsers = message.reactions.get(emoji) || [];
    if (!reactionUsers.includes(userId)) {
      reactionUsers.push(userId);
      message.reactions.set(emoji, reactionUsers);
      await message.save();
    }

    const sender = await this.userRepository.findOne({
      where: { id: message.senderId },
      select: ['id', 'name', 'email'],
    });

    const reactions = message.reactions ? Object.fromEntries(message.reactions) : {};

    return {
      ...message.toObject(),
      sender,
      reactions,
    };
  }

  async removeReaction(messageId: string, userId: string, emoji: string): Promise<any> {
    const message = await this.messageModel.findById(new Types.ObjectId(messageId)).exec();

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.reactions) {
      const reactionUsers = message.reactions.get(emoji) || [];
      const filtered = reactionUsers.filter(id => id !== userId);
      if (filtered.length === 0) {
        message.reactions.delete(emoji);
      } else {
        message.reactions.set(emoji, filtered);
      }
      await message.save();
    }

    const sender = await this.userRepository.findOne({
      where: { id: message.senderId },
      select: ['id', 'name', 'email'],
    });

    const reactions = message.reactions ? Object.fromEntries(message.reactions) : {};

    return {
      ...message.toObject(),
      sender,
      reactions,
    };
  }

  async updateGroup(chatId: string, userId: string, updateGroupDto: UpdateGroupDto): Promise<any> {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat || !chat.participants.includes(userId)) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.type !== 'group') {
      throw new BadRequestException('This endpoint is for group chats only');
    }

    const isAdmin = chat.adminId === userId || (chat.admins && chat.admins.includes(userId));

    if (!isAdmin) {
      throw new ForbiddenException('Only group admins can update the group');
    }

    if (updateGroupDto.name) {
      chat.name = updateGroupDto.name;
    }

    if (updateGroupDto.addParticipants) {
      const existingIds = chat.participants;
      const uniqueNew = updateGroupDto.addParticipants.filter(id => !existingIds.includes(id));
      chat.participants = [...chat.participants, ...uniqueNew];
    }

    if (updateGroupDto.removeParticipants) {
      chat.participants = chat.participants.filter(p => !updateGroupDto.removeParticipants!.includes(p));
      
      if (chat.adminId && updateGroupDto.removeParticipants.includes(chat.adminId)) {
        throw new BadRequestException('Cannot remove the main admin');
      }

      chat.admins = (chat.admins || []).filter(admin => !updateGroupDto.removeParticipants!.includes(admin));
    }

    if (updateGroupDto.addAdmins) {
      const existingAdminIds = chat.admins || [];
      const uniqueNewAdmins = updateGroupDto.addAdmins.filter(a => !existingAdminIds.includes(a));
      const validAdmins = uniqueNewAdmins.filter(a => chat.participants.includes(a));
      chat.admins = [...(chat.admins || []), ...validAdmins];
    }

    if (updateGroupDto.removeAdmins) {
      if (chat.adminId && updateGroupDto.removeAdmins.includes(chat.adminId)) {
        throw new BadRequestException('Cannot remove the main admin');
      }
      chat.admins = (chat.admins || []).filter(admin => !updateGroupDto.removeAdmins!.includes(admin));
    }

    const saved = await chat.save();
    return await this.enrichChatWithUsers(saved);
  }

  async leaveGroup(chatId: string, userId: string): Promise<void> {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat || !chat.participants.includes(userId)) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.type !== 'group') {
      throw new BadRequestException('This endpoint is for group chats only');
    }

    if (chat.adminId === userId) {
      throw new BadRequestException('Main admin cannot leave the group. Transfer admin rights first.');
    }

    chat.participants = chat.participants.filter(p => p !== userId);
    chat.admins = (chat.admins || []).filter(admin => admin !== userId);

    if (chat.participants.length === 0) {
      await this.chatModel.deleteOne({ _id: chat._id }).exec();
    } else {
      await chat.save();
    }
  }

  async transferAdmin(chatId: string, currentAdminId: string, newAdminId: string): Promise<any> {
    const chat = await this.chatModel.findById(chatId).exec();
    if (!chat || !chat.participants.includes(currentAdminId)) {
      throw new NotFoundException('Chat not found');
    }

    if (chat.type !== 'group') {
      throw new BadRequestException('This endpoint is for group chats only');
    }

    if (chat.adminId !== currentAdminId) {
      throw new ForbiddenException('Only the main admin can transfer admin rights');
    }

    if (!chat.participants.includes(newAdminId)) {
      throw new BadRequestException('New admin must be a group participant');
    }

    chat.adminId = newAdminId;
    if (!chat.admins || !chat.admins.includes(newAdminId)) {
      chat.admins = [...(chat.admins || []), newAdminId];
    }

    const saved = await chat.save();
    return await this.enrichChatWithUsers(saved);
  }
}

