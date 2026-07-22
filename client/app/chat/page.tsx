'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { AgoraChat } from 'agora-chat';
import type AC from 'agora-chat';

type AgoraSDK = typeof AC;
type AgoraConnection = AgoraChat.Connection;

interface UserProfile {
  id: string;
  username: string;
}

interface ChatMessage {
  id: string;
  from: string;
  msg: string;
  chatType: 'singleChat' | 'groupChat';
  timestamp: string;
  isSelf?: boolean;
}

type ConnectionStatus = 'Disconnected' | 'Connecting' | 'Connected' | 'Error';

const formatError = (err: unknown): string => {
  if (!err) return 'Unknown error occurred.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  const errObj = err as Record<string, unknown>;
  if (typeof errObj.message === 'string') return errObj.message;
  if (typeof errObj.error_description === 'string') return errObj.error_description;
  if (typeof errObj.error === 'string') return errObj.error;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

export default function ChatPage() {
  const router = useRouter();

  const [currentUser] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const storedUser = localStorage.getItem('currentUser');
      return storedUser ? (JSON.parse(storedUser) as UserProfile) : null;
    } catch {
      return null;
    }
  });

  const [userDirectory, setUserDirectory] = useState<UserProfile[]>([]);
  const [activeRecipient, setActiveRecipient] = useState<{ id: string; name: string; type: 'singleChat' | 'groupChat' }>({
    id: 'global_group',
    name: 'Global Group Chat',
    type: 'groupChat',
  });

  const [text, setText] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('Disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const connRef = useRef<AgoraConnection | null>(null);
  const acRef = useRef<AgoraSDK | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const getAgoraChatSDK = async (): Promise<AgoraSDK> => {
    if (acRef.current) return acRef.current;
    const agoraModule = await import('agora-chat');
    acRef.current = agoraModule.default as unknown as AgoraSDK;
    return acRef.current;
  };

  const fetchUserDirectory = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/users`);
      if (res.ok) {
        const data = (await res.json()) as UserProfile[];
        setUserDirectory(data);
      }
    } catch {
      // ignore
    }
  }, [apiUrl]);

  const connectAgoraChat = useCallback(async (username: string) => {
    if (!appId) {
      setErrorMessage('NEXT_PUBLIC_AGORA_APP_ID is not configured in environment.');
      return;
    }

    setStatus('Connecting');
    setErrorMessage(null);

    try {
      const SDK = await getAgoraChatSDK();

      const res = await fetch(`${apiUrl}/auth/agora-token/${encodeURIComponent(username)}`);
      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData.message || 'Failed to fetch Agora token');
      }
      const data = (await res.json()) as { token?: string };
      const token = data.token;

      if (!token) {
        throw new Error('Received invalid token from backend');
      }

      if (connRef.current) {
        connRef.current.removeEventHandler('AGORA_CHAT_HANDLER');
        connRef.current.close();
        connRef.current = null;
      }

      const connParams: AgoraChat.ConnectionParameters = appId.includes('#')
        ? { appKey: appId }
        : { appId: appId };

      const conn = new SDK.connection(connParams);
      connRef.current = conn;

      conn.addEventHandler('AGORA_CHAT_HANDLER', {
        onConnected: () => {
          setStatus('Connected');
          setErrorMessage(null);
        },
        onDisconnected: () => {
          setStatus('Disconnected');
        },
        onTextMessage: (message: AgoraChat.TextMsgBody) => {
          const textMsg = message as AgoraChat.TextMsgBody & { from?: string; chatType?: string };
          setMessages((prev) => [
            ...prev,
            {
              id: textMsg.id || String(Date.now() + Math.random()),
              from: textMsg.from || 'Unknown',
              msg: textMsg.msg || '',
              chatType: (textMsg.chatType as 'singleChat' | 'groupChat') || 'singleChat',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isSelf: false,
            },
          ]);
        },
        onError: (error: AgoraChat.ErrorEvent) => {
          setStatus('Error');
          setErrorMessage(formatError(error));
        },
      });

      try {
        await conn.open({
          user: username,
          accessToken: token,
        });
      } catch (openErr: unknown) {
        try {
          await conn.registerUser({
            username: username,
            password: `Pass_${username}_123`,
          });
          await conn.open({
            user: username,
            accessToken: token,
          });
        } catch {
          throw openErr;
        }
      }
    } catch (err: unknown) {
      setStatus('Error');
      setErrorMessage(formatError(err));
    }
  }, [appId, apiUrl]);

  useEffect(() => {
    if (!currentUser) {
      router.push('/login');
      return;
    }
    queueMicrotask(() => {
      fetchUserDirectory();
      connectAgoraChat(currentUser.username);
    });
  }, [router, currentUser, fetchUserDirectory, connectAgoraChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (connRef.current) {
        try {
          connRef.current.removeEventHandler('AGORA_CHAT_HANDLER');
          connRef.current.close();
          connRef.current = null;
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleLogout = () => {
    if (connRef.current) {
      try {
        connRef.current.removeEventHandler('AGORA_CHAT_HANDLER');
        connRef.current.close();
        connRef.current = null;
      } catch {
        // ignore
      }
    }
    localStorage.removeItem('currentUser');
    localStorage.removeItem('agoraToken');
    router.push('/login');
  };

  const sendMessage = async () => {
    if (!text.trim() || status !== 'Connected' || !connRef.current || !currentUser) {
      return;
    }

    setErrorMessage(null);
    const msgText = text.trim();

    try {
      const SDK = await getAgoraChatSDK();
      const option = {
        type: 'txt' as const,
        msg: msgText,
        to: activeRecipient.id,
        chatType: activeRecipient.type,
      };

      const msg = SDK.message.create(option);
      const res = await connRef.current.send(msg);

      setMessages((prev) => [
        ...prev,
        {
          id: res.localMsgId || String(Date.now()),
          from: currentUser.username,
          msg: msgText,
          chatType: activeRecipient.type,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSelf: true,
        },
      ]);
      setText('');
    } catch (err: unknown) {
      setErrorMessage('Failed to send message: ' + formatError(err));
    }
  };

  const currentMessages = messages.filter((m) => {
    if (activeRecipient.type === 'groupChat') {
      return m.chatType === 'groupChat';
    } else {
      return (
        m.chatType === 'singleChat' &&
        (m.from === activeRecipient.id || (m.isSelf && activeRecipient.id === activeRecipient.name))
      );
    }
  });

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans">
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white shadow">
              {currentUser?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <h2 className="text-sm font-semibold text-white truncate">{currentUser?.username || 'User'}</h2>
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
            onClick={handleLogout}
            title="Log out"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Channels</h3>
            <button
              onClick={() =>
                setActiveRecipient({ id: 'global_group', name: 'Global Group Chat', type: 'groupChat' })
              }
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${
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
                <p className="text-[10px] text-slate-400 truncate">Broadcast to all users</p>
              </div>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Direct Messages</h3>
              <button
                onClick={fetchUserDirectory}
                title="Refresh user directory"
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                ↻
              </button>
            </div>

            <div className="space-y-1">
              {userDirectory
                .filter((u) => u.username !== currentUser?.username)
                .map((u) => {
                  const isActive = activeRecipient.id === u.username;
                  return (
                    <button
                      key={u.id}
                      onClick={() =>
                        setActiveRecipient({ id: u.username, name: u.username, type: 'singleChat' })
                      }
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left ${
                        isActive
                          ? 'bg-blue-600 text-white font-medium shadow-lg shadow-blue-900/30'
                          : 'hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                        {u.username[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 truncate">
                        <p className="text-xs font-semibold truncate">{u.username}</p>
                        <p className="text-[10px] text-slate-400 truncate">Click to message</p>
                      </div>
                    </button>
                  );
                })}

              {userDirectory.length <= 1 && (
                <p className="text-xs text-slate-500 px-3 py-2 italic">No other registered users yet.</p>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-950">
        <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                activeRecipient.type === 'groupChat'
                  ? 'bg-purple-950 text-purple-300 border border-purple-800'
                  : 'bg-blue-950 text-blue-300 border border-blue-800'
              }`}
            >
              {activeRecipient.type === 'groupChat' ? '#' : activeRecipient.name[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                {activeRecipient.name}
              </h2>
              <span className="text-[10px] text-slate-400">
                {activeRecipient.type === 'groupChat' ? 'Group Channel' : '1-to-1 Direct Message'}
              </span>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="bg-rose-950/90 border-b border-rose-800 px-6 py-2 text-rose-200 text-xs flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="font-bold hover:text-white ml-4">
              ✕
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950">
          {currentMessages.length === 0 ? (
            <div className="my-auto text-center text-slate-500 py-20">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-600">
                💬
              </div>
              <p className="text-sm font-medium">No messages in this chat yet.</p>
              <p className="text-xs text-slate-600 mt-1">Send a message to start the conversation!</p>
            </div>
          ) : (
            currentMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-xs font-semibold text-slate-300">
                    {msg.isSelf ? 'You' : msg.from}
                  </span>
                  <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                </div>
                <div
                  className={`max-w-md px-4 py-2.5 rounded-2xl text-sm wrap-break-word shadow-md ${
                    msg.isSelf
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-900 text-slate-100 border border-slate-800 rounded-tl-none'
                  }`}
                >
                  {msg.msg}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-slate-900/90 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-3"
          >
            <input
              type="text"
              placeholder={`Message ${activeRecipient.name}...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={status !== 'Connected'}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition"
            />
            <button
              type="submit"
              disabled={status !== 'Connected' || !text.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium px-6 py-3 rounded-xl text-sm transition shadow-lg shadow-blue-900/30 flex items-center gap-2"
            >
              <span>Send</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
