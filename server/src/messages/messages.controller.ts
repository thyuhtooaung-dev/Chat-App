import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(@Body() createMessageDto: CreateMessageDto) {
    return this.messagesService.create(createMessageDto);
  }

  @Get()
  findPaginated(
    @Query('userId') userId: string,
    @Query('recipientId') recipientId: string,
    @Query('chatType') chatType: 'singleChat' | 'groupChat',
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('before') before?: string,
  ) {
    return this.messagesService.findPaginated(
      userId,
      recipientId,
      chatType,
      limit,
      before,
    );
  }

  @Get('conversations')
  getConversations(@Query('userId') userId: string) {
    return this.messagesService.getConversations(userId);
  }

  @Patch('read')
  markAsRead(
    @Query('userId') userId: string,
    @Query('recipientId') recipientId: string,
    @Query('chatType') chatType: 'singleChat' | 'groupChat',
  ) {
    return this.messagesService.markAsRead(userId, recipientId, chatType);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('senderId') senderId: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    return this.messagesService.update(id, senderId, updateMessageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('senderId') senderId: string) {
    return this.messagesService.remove(id, senderId);
  }
}
