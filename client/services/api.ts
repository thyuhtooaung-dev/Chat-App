import { UserProfile, ConversationSummary, DBMessageResponse } from '../types/chat';

const getApiUrl = (): string =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export const fetchUserDirectory = async (): Promise<UserProfile[]> => {
  const res = await fetch(`${getApiUrl()}/users`);
  if (!res.ok) throw new Error('Failed to fetch user directory');
  return res.json();
};

export const fetchConversations = async (
  userId: string,
  username?: string,
): Promise<ConversationSummary[]> => {
  const queryParams = new URLSearchParams({ userId });
  if (username) {
    queryParams.append('username', username);
  }
  const res = await fetch(`${getApiUrl()}/messages/conversations?${queryParams.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
};

export const fetchMessagesHistory = async (
  userId: string,
  username: string,
  recipientId: string,
  chatType: 'singleChat' | 'groupChat',
  before?: string,
  limit: number = 50,
): Promise<{ messages: DBMessageResponse[]; hasMore: boolean }> => {
  const queryParams = new URLSearchParams({
    userId,
    username,
    recipientId,
    chatType,
    limit: String(limit),
  });
  if (before) {
    queryParams.append('before', before);
  }

  const res = await fetch(`${getApiUrl()}/messages?${queryParams.toString()}`);
  if (!res.ok) throw new Error('Failed to load message history');
  return res.json();
};

export const saveMessageToDB = async (data: {
  senderId: string;
  senderUsername: string;
  recipientId: string;
  chatType: 'singleChat' | 'groupChat';
  content: string;
}): Promise<DBMessageResponse> => {
  const res = await fetch(`${getApiUrl()}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save message');
  return res.json();
};

export const updateMessageInDB = async (
  id: string,
  senderId: string,
  content: string,
): Promise<DBMessageResponse> => {
  const res = await fetch(`${getApiUrl()}/messages/${id}?senderId=${senderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Failed to edit message');
  return res.json();
};

export const deleteMessageInDB = async (
  id: string,
  senderId: string,
): Promise<DBMessageResponse> => {
  const res = await fetch(`${getApiUrl()}/messages/${id}?senderId=${senderId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete message');
  return res.json();
};

export const markMessagesAsRead = async (
  userId: string,
  username: string,
  recipientId: string,
  chatType: 'singleChat' | 'groupChat',
): Promise<void> => {
  await fetch(
    `${getApiUrl()}/messages/read?userId=${userId}&username=${encodeURIComponent(
      username,
    )}&recipientId=${recipientId}&chatType=${chatType}`,
    { method: 'PATCH' },
  );
};

export const sendUserHeartbeat = async (userId: string): Promise<void> => {
  await fetch(`${getApiUrl()}/users/${userId}/heartbeat`, { method: 'POST' });
};

export const updateUserProfileBio = async (
  userId: string,
  bio: string,
): Promise<UserProfile> => {
  const res = await fetch(`${getApiUrl()}/users/${userId}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bio }),
  });
  if (!res.ok) throw new Error('Failed to update bio');
  return res.json();
};

export const fetchAgoraToken = async (username: string): Promise<string> => {
  const res = await fetch(`${getApiUrl()}/auth/agora-token/${encodeURIComponent(username)}`);
  if (!res.ok) {
    const errorData = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(errorData.message || 'Failed to fetch Agora token');
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error('Received invalid token from backend');
  return data.token;
};
