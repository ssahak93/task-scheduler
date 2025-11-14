import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateMessageDto } from './dto/create-message.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddReactionDto } from './dto/add-reaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  @Get()
  getUserChats(@Request() req: any) {
    return this.chatService.getUserChats(req.user.id);
  }

  @Get(':id')
  getChat(@Param('id') id: string, @Request() req: any) {
    return this.chatService.getChatById(id, req.user.id);
  }

  @Get(':id/messages')
  getMessages(
    @Param('id') id: string,
    @Query('limit', ParseIntPipe) limit: number = 50,
    @Query('offset', ParseIntPipe) offset: number = 0,
    @Request() req: any,
  ) {
    return this.chatService.getChatMessages(id, req.user.id, limit, offset);
  }

  @Post('direct/:userId')
  findOrCreateDirectChat(@Param('userId') userId: string, @Request() req: any) {
    return this.chatService.findOrCreateDirectChat(req.user.id, userId);
  }

  @Post('group')
  createGroupChat(@Body() createChatDto: CreateChatDto, @Request() req: any) {
    return this.chatService.createGroupChat(req.user.id, createChatDto);
  }

  @Put('group/:id')
  async updateGroup(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @Request() req: any,
  ) {
    const chat = await this.chatService.updateGroup(id, req.user.id, updateGroupDto);
    this.chatGateway.broadcastGroupUpdate(id, chat);
    return chat;
  }

  @Post('group/:id/transfer-admin/:newAdminId')
  transferAdmin(
    @Param('id') id: string,
    @Param('newAdminId') newAdminId: string,
    @Request() req: any,
  ) {
    return this.chatService.transferAdmin(id, req.user.id, newAdminId);
  }

  @Post('group/:id/leave')
  leaveGroup(@Param('id') id: string, @Request() req: any) {
    return this.chatService.leaveGroup(id, req.user.id);
  }

  @Post(':id/messages')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async createMessage(
    @Param('id') chatId: string,
    @Body() createMessageDto: CreateMessageDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    const message = await this.chatService.createMessage(
      req.user.id,
      { ...createMessageDto, chatId },
      file,
    );
    
    this.chatGateway.broadcastMessage(chatId, message);
    return message;
  }

  @Put('messages/:id')
  async updateMessage(
    @Param('id') id: string,
    @Body('content') content: string,
    @Request() req: any,
  ) {
    const message = await this.chatService.updateMessage(id, req.user.id, content);
    this.chatGateway.broadcastMessageUpdate(message.chatId, message);
    return message;
  }

  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string, @Request() req: any) {
    const message = await this.messageModel.findById(id).exec();
    if (message) {
      await this.chatService.deleteMessage(id, req.user.id);
      this.chatGateway.broadcastMessageDelete(message.chatId, id);
    }
  }

  @Post(':id/read')
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.chatService.markMessagesAsRead(id, req.user.id);
  }

  @Post('messages/:id/reactions')
  async addReaction(
    @Param('id') id: string,
    @Body() addReactionDto: AddReactionDto,
    @Request() req: any,
  ) {
    const message = await this.chatService.addReaction(id, req.user.id, addReactionDto.emoji);
    const chat = await this.chatService.getChatById(message.chatId, req.user.id);
    this.chatGateway.broadcastMessageUpdate(message.chatId, message);
    return message;
  }

  @Delete('messages/:id/reactions/:emoji')
  async removeReaction(
    @Param('id') id: string,
    @Param('emoji') emoji: string,
    @Request() req: any,
  ) {
    const message = await this.chatService.removeReaction(id, req.user.id, decodeURIComponent(emoji));
    this.chatGateway.broadcastMessageUpdate(message.chatId, message);
    return message;
  }
}

