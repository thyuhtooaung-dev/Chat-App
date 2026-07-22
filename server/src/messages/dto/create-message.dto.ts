export class CreateMessageDto {
  senderId: string;
  senderUsername: string;
  recipientId: string;
  chatType: 'singleChat' | 'groupChat';
  content: string;
}

export class UpdateMessageDto {
  content: string;
}
