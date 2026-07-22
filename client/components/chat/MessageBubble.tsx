import React from 'react';
import { ChatMessage, UserProfile } from '../../types/chat';

interface MessageBubbleProps {
  msg: ChatMessage;
  editingMessageId: string | null;
  editText: string;
  onSetEditText: (text: string) => void;
  onStartEditing: (msg: ChatMessage) => void;
  onCancelEditing: () => void;
  onSaveEdit: (msgId: string) => void;
  onDeleteMessage: (msgId: string) => void;
  onOpenProfileByUsername: (username: string) => void;
  userDirectory: UserProfile[];
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  msg,
  editingMessageId,
  editText,
  onSetEditText,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onDeleteMessage,
  onOpenProfileByUsername,
  userDirectory,
}) => {
  const isEditingThis = editingMessageId === msg.id;

  const getAvatarColor = (senderName: string) => {
    const user = userDirectory.find((u) => u.username === senderName);
    return user?.avatarColor || '#3B82F6';
  };

  return (
    <div
      className={`flex items-end gap-2 group ${
        msg.isSelf ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Sender Avatar */}
      <div
        onClick={() => onOpenProfileByUsername(msg.from)}
        style={{ backgroundColor: getAvatarColor(msg.from) }}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 cursor-pointer shadow hover:opacity-90 transition"
      >
        {msg.from[0]?.toUpperCase()}
      </div>

      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md text-xs relative ${
          msg.isSelf
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none'
            : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-bl-none'
        }`}
      >
        {/* Sender Name in Groups */}
        {!msg.isSelf && (
          <p
            onClick={() => onOpenProfileByUsername(msg.from)}
            className="text-[10px] font-bold text-blue-400 mb-1 cursor-pointer hover:underline"
          >
            {msg.from}
          </p>
        )}

        {/* Message Content / Edit Mode */}
        {isEditingThis ? (
          <div className="space-y-2 mt-1">
            <textarea
              value={editText}
              onChange={(e) => onSetEditText(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={onCancelEditing}
                className="text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => onSaveEdit(msg.id)}
                className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-1 rounded transition cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p
            className={`whitespace-pre-wrap break-words leading-relaxed ${
              msg.isDeleted ? 'italic text-slate-400 opacity-80' : ''
            }`}
          >
            {msg.msg}
          </p>
        )}

        {/* Timestamp, Edited Badge & Read Receipts */}
        <div
          className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
            msg.isSelf ? 'text-blue-200 opacity-90' : 'text-slate-400'
          }`}
        >
          {msg.isEdited && !msg.isDeleted && <span className="italic">(edited)</span>}
          <span>{msg.timestamp}</span>

          {msg.isSelf && !msg.isDeleted && (
            <span
              className={`text-[11px] font-bold shrink-0 ${
                msg.isRead ? 'text-cyan-300' : 'text-blue-200 opacity-70'
              }`}
            >
              {msg.isRead ? '✓✓' : '✓'}
            </span>
          )}
        </div>

        {/* Edit / Delete Hover Action Menu */}
        {msg.isSelf && !msg.isDeleted && !isEditingThis && (
          <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 rounded-lg shadow px-1.5 py-0.5 flex gap-1 z-10">
            <button
              onClick={() => onStartEditing(msg)}
              className="text-[10px] text-slate-300 hover:text-blue-400 px-1 cursor-pointer"
              title="Edit message"
            >
              ✏️
            </button>
            <button
              onClick={() => onDeleteMessage(msg.id)}
              className="text-[10px] text-slate-300 hover:text-rose-400 px-1 cursor-pointer"
              title="Delete message"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
