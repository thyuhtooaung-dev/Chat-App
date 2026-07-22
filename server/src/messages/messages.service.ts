import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { Message } from './message.entity';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';

export interface ConversationSummary {
  id: string;
  name: string;
  type: 'singleChat' | 'groupChat';
  lastMessage?: string;
  lastMessageTime?: Date;
  isDeleted?: boolean;
  isEdited?: boolean;
  unreadCount?: number;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async create(dto: CreateMessageDto): Promise<Message> {
    const msg = this.messageRepository.create({
      senderId: dto.senderId,
      senderUsername: dto.senderUsername,
      recipientId: dto.recipientId,
      chatType: dto.chatType,
      content: dto.content,
      isRead: false,
    });
    return await this.messageRepository.save(msg);
  }

  async findPaginated(
    userId: string,
    recipientId: string,
    chatType: 'singleChat' | 'groupChat',
    limit: number = 50,
    before?: string,
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const query = this.messageRepository.createQueryBuilder('msg');

    if (chatType === 'groupChat') {
      query.where(
        'msg.recipientId = :recipientId AND msg.chatType = :chatType',
        {
          recipientId,
          chatType: 'groupChat',
        },
      );
    } else {
      query
        .where(
          new Brackets((qb) => {
            qb.where(
              'msg.senderId = :userId AND msg.recipientId = :recipientId',
              {
                userId,
                recipientId,
              },
            ).orWhere(
              'msg.senderId = :recipientId AND msg.recipientId = :userId',
              {
                userId,
                recipientId,
              },
            );
          }),
        )
        .andWhere('msg.chatType = :chatType', { chatType: 'singleChat' });
    }

    if (before) {
      const cursorMessage = await this.messageRepository.findOne({
        where: { id: before },
      });
      if (cursorMessage) {
        query.andWhere('msg.createdAt < :createdAt', {
          createdAt: cursorMessage.createdAt,
        });
      }
    }

    query.orderBy('msg.createdAt', 'DESC');
    query.take(limit + 1);

    const results = await query.getMany();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;

    // Return in chronological order for UI rendering
    return {
      messages: items.reverse(),
      hasMore,
    };
  }

  async markAsRead(
    userId: string,
    recipientId: string,
    chatType: 'singleChat' | 'groupChat',
  ): Promise<{ updatedCount: number }> {
    if (chatType === 'singleChat') {
      const result = await this.messageRepository
        .createQueryBuilder()
        .update(Message)
        .set({ isRead: true })
        .where(
          '(senderId = :recipientId OR senderUsername = :recipientId) AND recipientId = :userId AND isRead = false',
          { recipientId, userId },
        )
        .execute();
      return { updatedCount: result.affected || 0 };
    } else {
      const result = await this.messageRepository
        .createQueryBuilder()
        .update(Message)
        .set({ isRead: true })
        .where(
          'recipientId = :recipientId AND senderId != :userId AND isRead = false',
          {
            recipientId,
            userId,
          },
        )
        .execute();
      return { updatedCount: result.affected || 0 };
    }
  }

  async getConversations(userId: string): Promise<ConversationSummary[]> {
    const subQuery = this.messageRepository
      .createQueryBuilder('m')
      .where(
        'm.senderId = :userId OR m.recipientId = :userId OR m.recipientId = :globalGroup',
        {
          userId,
          globalGroup: 'global_group',
        },
      )
      .orderBy('m.createdAt', 'DESC');

    const messages = await subQuery.getMany();

    const conversationsMap = new Map<string, ConversationSummary>();
    const unreadCountsMap = new Map<string, number>();

    for (const msg of messages) {
      let key: string;
      let name: string;
      let type: 'singleChat' | 'groupChat';

      if (msg.chatType === 'groupChat') {
        key = msg.recipientId;
        name =
          msg.recipientId === 'global_group'
            ? 'Global Group Chat'
            : msg.recipientId;
        type = 'groupChat';

        if (msg.senderId !== userId && !msg.isRead) {
          unreadCountsMap.set(key, (unreadCountsMap.get(key) || 0) + 1);
        }
      } else {
        const otherPerson =
          msg.senderId === userId ? msg.recipientId : msg.senderId;
        const otherUsername =
          msg.senderId === userId ? msg.recipientId : msg.senderUsername;
        key = otherPerson;
        name = otherUsername;
        type = 'singleChat';

        if (msg.recipientId === userId && !msg.isRead) {
          unreadCountsMap.set(key, (unreadCountsMap.get(key) || 0) + 1);
        }
      }

      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          id: key,
          name,
          type,
          lastMessage: msg.isDeleted ? 'This message was deleted' : msg.content,
          lastMessageTime: msg.createdAt,
          isDeleted: msg.isDeleted,
          isEdited: msg.isEdited,
          unreadCount: 0,
        });
      }
    }

    const conversations = Array.from(conversationsMap.values()).map((c) => ({
      ...c,
      unreadCount: unreadCountsMap.get(c.id) || 0,
    }));

    return conversations.sort((a, b) => {
      const timeA = a.lastMessageTime
        ? new Date(a.lastMessageTime).getTime()
        : 0;
      const timeB = b.lastMessageTime
        ? new Date(b.lastMessageTime).getTime()
        : 0;
      return timeB - timeA;
    });
  }

  async update(
    id: string,
    senderId: string,
    dto: UpdateMessageDto,
  ): Promise<Message> {
    const msg = await this.messageRepository.findOne({ where: { id } });
    if (!msg) {
      throw new NotFoundException('Message not found');
    }
    if (msg.senderId !== senderId && msg.senderUsername !== senderId) {
      throw new ForbiddenException('You can only edit your own messages');
    }
    msg.content = dto.content;
    msg.isEdited = true;
    return await this.messageRepository.save(msg);
  }

  async remove(id: string, senderId: string): Promise<Message> {
    const msg = await this.messageRepository.findOne({ where: { id } });
    if (!msg) {
      throw new NotFoundException('Message not found');
    }
    if (msg.senderId !== senderId && msg.senderUsername !== senderId) {
      throw new ForbiddenException('You can only delete your own messages');
    }
    msg.isDeleted = true;
    msg.content = 'This message was deleted';
    return await this.messageRepository.save(msg);
  }
}
