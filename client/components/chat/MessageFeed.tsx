import React from 'react';
import { ChatMessage, UserProfile } from '../../types/chat';
import { MessageBubble } from './MessageBubble';

interface MessageFeedProps {
  isLoadingHistory: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  messages: ChatMessage[];
  editingMessageId: string | null;
  editText: string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onLoadOlderMessages: () => void;
  onSetEditText: (text: string) => void;
  onStartEditing: (msg: ChatMessage) => void;
  onCancelEditing: () => void;
  onSaveEdit: (msgId: string) => void;
  onDeleteMessage: (msgId: string) => void;
  onOpenProfileByUsername: (username: string) => void;
  userDirectory: UserProfile[];
}

export const MessageFeed: React.FC<MessageFeedProps> = ({
  isLoadingHistory,
  isLoadingMore,
  hasMore,
  messages,
  editingMessageId,
  editText,
  scrollContainerRef,
  messagesEndRef,
  onLoadOlderMessages,
  onSetEditText,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onDeleteMessage,
  onOpenProfileByUsername,
  userDirectory,
}) => {
  if (isLoadingHistory) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Loading message history...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950"
    >
      {/* Pagination Load More Button */}
      {hasMore && (
        <div className="flex justify-center my-2">
          <button
            onClick={onLoadOlderMessages}
            disabled={isLoadingMore}
            className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full transition disabled:opacity-50 cursor-pointer shadow"
          >
            {isLoadingMore ? 'Loading older messages...' : '↑ Load older messages'}
          </button>
        </div>
      )}

      {/* Message List */}
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          msg={msg}
          editingMessageId={editingMessageId}
          editText={editText}
          onSetEditText={onSetEditText}
          onStartEditing={onStartEditing}
          onCancelEditing={onCancelEditing}
          onSaveEdit={onSaveEdit}
          onDeleteMessage={onDeleteMessage}
          onOpenProfileByUsername={onOpenProfileByUsername}
          userDirectory={userDirectory}
        />
      ))}

      {messages.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
          <p className="text-sm">No messages yet.</p>
          <p className="text-xs text-slate-600 mt-1">
            Send a message to start the conversation!
          </p>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
