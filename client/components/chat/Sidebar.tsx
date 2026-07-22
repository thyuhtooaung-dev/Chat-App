import React from 'react';
import { UserProfile, ConversationSummary, Recipient, ConnectionStatus } from '../../types/chat';

interface SidebarProps {
  currentUser: UserProfile | null;
  status: ConnectionStatus;
  userDirectory: UserProfile[];
  conversations: ConversationSummary[];
  activeRecipient: Recipient;
  onSelectRecipient: (recipient: Recipient) => void;
  onOpenProfile: (user: UserProfile) => void;
  onRefreshDirectory: () => void;
  onLogout: () => void;
  formatLastSeen: (lastSeen?: string, isOnline?: boolean) => string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  status,
  userDirectory,
  conversations,
  activeRecipient,
  onSelectRecipient,
  onOpenProfile,
  onRefreshDirectory,
  onLogout,
  formatLastSeen,
}) => {
  const getSidebarSummary = (recipientId: string) => {
    return conversations.find((c) => c.id === recipientId);
  };

  const globalSummary = getSidebarSummary('global_group');
  const globalUnread = globalSummary?.unreadCount || 0;

  return (
    <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
      {/* Current User Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div
          onClick={() => currentUser && onOpenProfile(currentUser)}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div
            style={{ backgroundColor: currentUser?.avatarColor || '#3B82F6' }}
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow group-hover:opacity-90 transition"
          >
            {currentUser?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="overflow-hidden">
            <h2 className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition">
              {currentUser?.username || 'User'}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  status === 'Connected' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] text-slate-400">{status}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          title="Log out"
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      </div>

      {/* Conversations / Direct Messages List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Channels */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Channels
          </h3>
          <button
            onClick={() =>
              onSelectRecipient({
                id: 'global_group',
                name: 'Global Group Chat',
                type: 'groupChat',
              })
            }
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left cursor-pointer ${
              activeRecipient.id === 'global_group'
                ? 'bg-blue-600 text-white font-medium shadow-lg shadow-blue-900/30'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-purple-900/50 border border-purple-700/50 flex items-center justify-center text-purple-300 font-bold text-xs">
              #
            </div>
            <div className="flex-1 truncate">
              <p className="text-xs font-semibold">Global Group Chat</p>
              <p className="text-[10px] opacity-80 truncate">
                {globalSummary?.lastMessage || 'Broadcast to all users'}
              </p>
            </div>
            {globalUnread > 0 && (
              <span className="bg-rose-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow">
                {globalUnread}
              </span>
            )}
          </button>
        </div>

        {/* Direct Messages */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Direct Messages
            </h3>
            <button
              onClick={onRefreshDirectory}
              title="Refresh contacts"
              className="text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
            >
              ↻
            </button>
          </div>

          <div className="space-y-1">
            {userDirectory
              .filter((u) => u.username !== currentUser?.username)
              .map((u) => {
                const isActive = activeRecipient.id === u.username;
                const summary = getSidebarSummary(u.username);
                const unread = summary?.unreadCount || 0;
                return (
                  <button
                    key={u.id}
                    onClick={() =>
                      onSelectRecipient({
                        id: u.username,
                        name: u.username,
                        type: 'singleChat',
                      })
                    }
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white font-medium shadow-lg shadow-blue-900/30'
                        : 'hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="relative">
                      <div
                        style={{ backgroundColor: u.avatarColor || '#3B82F6' }}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                      >
                        {u.username[0]?.toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                          u.isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    <div className="flex-1 truncate">
                      <p className="text-xs font-semibold truncate flex items-center justify-between">
                        <span>{u.username}</span>
                        <span className="text-[9px] font-normal opacity-70">
                          {formatLastSeen(u.lastSeen, u.isOnline)}
                        </span>
                      </p>
                      <p className="text-[10px] opacity-80 truncate">
                        {summary?.lastMessage || (u.bio ? u.bio : 'Click to message')}
                      </p>
                    </div>

                    {unread > 0 && (
                      <span className="bg-rose-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}

            {userDirectory.length <= 1 && (
              <p className="text-xs text-slate-500 px-3 py-2 italic">
                No other registered users yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
