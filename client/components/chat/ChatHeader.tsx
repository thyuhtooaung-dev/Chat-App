import React from 'react';
import { UserProfile, Recipient } from '../../types/chat';

interface ChatHeaderProps {
  activeRecipient: Recipient;
  activeContactUser?: UserProfile;
  isRecipientTyping: boolean;
  onOpenProfile: (user: UserProfile) => void;
  formatLastSeen: (lastSeen?: string, isOnline?: boolean) => string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeRecipient,
  activeContactUser,
  isRecipientTyping,
  onOpenProfile,
  formatLastSeen,
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
      <div
        onClick={() => {
          if (activeContactUser) {
            onOpenProfile(activeContactUser);
          }
        }}
        className="flex items-center gap-3 cursor-pointer group"
      >
        <div
          style={{
            backgroundColor:
              activeRecipient.type === 'groupChat'
                ? '#581C87'
                : activeContactUser?.avatarColor || '#1E40AF',
          }}
          className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white border border-slate-700/50 shadow"
        >
          {activeRecipient.type === 'groupChat'
            ? '#'
            : activeRecipient.name[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2 group-hover:text-blue-400 transition">
            {activeRecipient.name}
          </h2>
          <span className="text-[10px] text-slate-400 block">
            {isRecipientTyping ? (
              <span className="text-blue-400 font-semibold animate-pulse">
                is typing...
              </span>
            ) : activeRecipient.type === 'groupChat' ? (
              'Group Channel'
            ) : (
              formatLastSeen(
                activeContactUser?.lastSeen,
                activeContactUser?.isOnline,
              )
            )}
          </span>
        </div>
      </div>
    </header>
  );
};
