export interface UserProfile {
  id: string;
  username: string;
  bio?: string;
  avatarColor?: string;
  lastSeen?: string;
  isOnline?: boolean;
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  senderId?: string;
  from: string;
  msg: string;
  chatType: 'singleChat' | 'groupChat';
  timestamp: string;
  createdAt?: string;
  isSelf?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  isRead?: boolean;
}

export interface ConversationSummary {
  id: string;
  name: string;
  type: 'singleChat' | 'groupChat';
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

export interface Recipient {
  id: string;
  name: string;
  type: 'singleChat' | 'groupChat';
}

export type ConnectionStatus = 'Disconnected' | 'Connecting' | 'Connected' | 'Error';

export interface DBMessageResponse {
  id: string;
  senderId: string;
  senderUsername: string;
  recipientId: string;
  chatType: 'singleChat' | 'groupChat';
  content: string;
  isEdited: boolean;
  isDeleted: boolean;
  isRead: boolean;
  createdAt: string;
}
