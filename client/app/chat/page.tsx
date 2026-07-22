"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { AgoraChat } from "agora-chat";
import type AC from "agora-chat";

type AgoraSDK = typeof AC;
type AgoraConnection = AgoraChat.Connection;

interface UserProfile {
  id: string;
  username: string;
  bio?: string;
  avatarColor?: string;
  lastSeen?: string;
  isOnline?: boolean;
  createdAt?: string;
}

interface ChatMessage {
  id: string;
  senderId?: string;
  from: string;
  msg: string;
  chatType: "singleChat" | "groupChat";
  timestamp: string;
  createdAt?: string;
  isSelf?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  isRead?: boolean;
}

interface ConversationSummary {
  id: string;
  name: string;
  type: "singleChat" | "groupChat";
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

type ConnectionStatus = "Disconnected" | "Connecting" | "Connected" | "Error";

const formatError = (err: unknown): string => {
  if (!err) return "Unknown error occurred.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const errObj = err as Record<string, unknown>;
  if (typeof errObj.message === "string") return errObj.message;
  if (typeof errObj.error_description === "string")
    return errObj.error_description;
  if (typeof errObj.error === "string") return errObj.error;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const formatLastSeen = (lastSeenDate?: string, isOnline?: boolean): string => {
  if (isOnline) return "Online";
  if (!lastSeenDate) return "Offline";
  const diffMs = Date.now() - new Date(lastSeenDate).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return "Last seen just now";
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Last seen ${diffDays}d ago`;
};

export default function ChatPage() {
  const router = useRouter();

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setIsMounted(true);
      try {
        const storedUser = localStorage.getItem("currentUser");
        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser) as UserProfile);
        }
      } catch {
        // ignore
      }
    });
  }, []);

  const [userDirectory, setUserDirectory] = useState<UserProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeRecipient, setActiveRecipient] = useState<{
    id: string;
    name: string;
    type: "singleChat" | "groupChat";
  }>({
    id: "global_group",
    name: "Global Group Chat",
    type: "groupChat",
  });

  const [text, setText] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");

  const [status, setStatus] = useState<ConnectionStatus>("Disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phase 2 States
  const [isRecipientTyping, setIsRecipientTyping] = useState<boolean>(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [editBioText, setEditBioText] = useState<string>("");
  const [isSavingBio, setIsSavingBio] = useState<boolean>(false);

  const activeRecipientRef = useRef(activeRecipient);
  useEffect(() => {
    activeRecipientRef.current = activeRecipient;
  }, [activeRecipient]);

  const connectedUserRef = useRef<string | null>(null);

  const connRef = useRef<AgoraConnection | null>(null);
  const acRef = useRef<AgoraSDK | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  const getAgoraChatSDK = async (): Promise<AgoraSDK> => {
    if (acRef.current) return acRef.current;
    const agoraModule = await import("agora-chat");
    acRef.current = agoraModule.default as unknown as AgoraSDK;
    return acRef.current;
  };

  const fetchUserDirectory = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/users`);
      if (res.ok) {
        const data = (await res.json()) as UserProfile[];
        setUserDirectory(data);
        if (currentUser) {
          const freshCurrent = data.find((u) => u.id === currentUser.id);
          if (freshCurrent) {
            setCurrentUser(freshCurrent);
            localStorage.setItem("currentUser", JSON.stringify(freshCurrent));
          }
        }
      }
    } catch {
      // ignore
    }
  }, [apiUrl, currentUser]);

  const fetchConversations = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${apiUrl}/messages/conversations?userId=${currentUser.id}`,
      );
      if (res.ok) {
        const data = (await res.json()) as ConversationSummary[];
        setConversations(data);
      }
    } catch {
      // ignore
    }
  }, [apiUrl, currentUser]);

  const markConversationAsRead = useCallback(
    async (recipId: string, type: "singleChat" | "groupChat") => {
      if (!currentUser) return;
      try {
        await fetch(
          `${apiUrl}/messages/read?userId=${currentUser.id}&recipientId=${recipId}&chatType=${type}`,
          { method: "PATCH" },
        );
        fetchConversations();
      } catch {
        // ignore
      }
    },
    [apiUrl, currentUser, fetchConversations],
  );

  interface DBMessageResponse {
    id: string;
    senderId: string;
    senderUsername: string;
    recipientId: string;
    chatType: "singleChat" | "groupChat";
    content: string;
    isEdited: boolean;
    isDeleted: boolean;
    isRead: boolean;
    createdAt: string;
  }

  const loadOlderMessages = async () => {
    if (!currentUser || messages.length === 0) return;
    setIsLoadingMore(true);

    try {
      const oldestMsgId = messages[0].id;
      const queryParams = new URLSearchParams({
        userId: currentUser.id,
        recipientId: activeRecipient.id,
        chatType: activeRecipient.type,
        limit: "50",
        before: oldestMsgId,
      });

      const res = await fetch(`${apiUrl}/messages?${queryParams.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as {
          messages: DBMessageResponse[];
          hasMore: boolean;
        };
        const formatted: ChatMessage[] = data.messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          from: m.senderUsername || m.senderId,
          msg: m.content,
          chatType: m.chatType,
          timestamp: new Date(m.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          createdAt: m.createdAt,
          isSelf:
            m.senderId === currentUser.id ||
            m.senderUsername === currentUser.username,
          isEdited: m.isEdited,
          isDeleted: m.isDeleted,
          isRead: m.isRead,
        }));

        setHasMore(data.hasMore);
        setMessages((prev) => [...formatted, ...prev]);
      }
    } catch {
      setErrorMessage("Failed to load message history.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    let isCancelled = false;

    const loadInitialHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const queryParams = new URLSearchParams({
          userId: currentUser.id,
          recipientId: activeRecipient.id,
          chatType: activeRecipient.type,
          limit: "50",
        });

        const res = await fetch(`${apiUrl}/messages?${queryParams.toString()}`);
        if (res.ok && !isCancelled) {
          const data = (await res.json()) as {
            messages: DBMessageResponse[];
            hasMore: boolean;
          };
          const formatted: ChatMessage[] = data.messages.map((m) => ({
            id: m.id,
            senderId: m.senderId,
            from: m.senderUsername || m.senderId,
            msg: m.content,
            chatType: m.chatType,
            timestamp: new Date(m.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            createdAt: m.createdAt,
            isSelf:
              m.senderId === currentUser.id ||
              m.senderUsername === currentUser.username,
            isEdited: m.isEdited,
            isDeleted: m.isDeleted,
            isRead: m.isRead,
          }));

          setHasMore(data.hasMore);
          setMessages(formatted);

          // Mark conversation read on load
          markConversationAsRead(activeRecipient.id, activeRecipient.type);
        }
      } catch {
        if (!isCancelled) setErrorMessage("Failed to load message history.");
      } finally {
        if (!isCancelled) setIsLoadingHistory(false);
      }
    };

    loadInitialHistory();

    return () => {
      isCancelled = true;
    };
  }, [activeRecipient.id, activeRecipient.type, currentUser, apiUrl, markConversationAsRead]);

  // Heartbeat loop every 15 seconds
  useEffect(() => {
    if (!currentUser) return;
    const sendHeartbeat = async () => {
      try {
        await fetch(`${apiUrl}/users/${currentUser.id}/heartbeat`, { method: "POST" });
        fetchUserDirectory();
      } catch {
        // ignore
      }
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 15000);
    return () => clearInterval(interval);
  }, [currentUser, apiUrl, fetchUserDirectory]);

  const connectAgoraChat = useCallback(
    async (username: string) => {
      if (!appId) {
        setErrorMessage("NEXT_PUBLIC_AGORA_APP_ID is not configured in environment.");
        return;
      }

      if (connectedUserRef.current === username && connRef.current) {
        return;
      }

      setStatus("Connecting");
      setErrorMessage(null);

      try {
        const SDK = await getAgoraChatSDK();

        const res = await fetch(
          `${apiUrl}/auth/agora-token/${encodeURIComponent(username)}`,
        );
        if (!res.ok) {
          const errorData = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          throw new Error(errorData.message || "Failed to fetch Agora token");
        }
        const data = (await res.json()) as { token?: string };
        const token = data.token;

        if (!token) {
          throw new Error("Received invalid token from backend");
        }

        if (connRef.current) {
          try {
            connRef.current.removeEventHandler("AGORA_CHAT_HANDLER");
            connRef.current.close();
          } catch {
            // ignore
          }
          connRef.current = null;
        }

        const connParams: AgoraChat.ConnectionParameters = appId.includes("#")
          ? { appKey: appId }
          : { appId: appId };

        const conn = new SDK.connection(connParams);
        connRef.current = conn;
        connectedUserRef.current = username;

        conn.addEventHandler("AGORA_CHAT_HANDLER", {
          onConnected: () => {
            setStatus("Connected");
            setErrorMessage(null);
          },
          onDisconnected: () => {
            setStatus("Disconnected");
            connectedUserRef.current = null;
          },
          onTextMessage: (message: AgoraChat.TextMsgBody) => {
            const textMsg = message as AgoraChat.TextMsgBody & {
              from?: string;
              chatType?: string;
            };

            const currentRecip = activeRecipientRef.current;

            // Check if typing signal
            if (textMsg.msg === "__TYPING__") {
              if (textMsg.from === currentRecip.id) {
                setIsRecipientTyping(true);
                if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                typingTimerRef.current = setTimeout(() => {
                  setIsRecipientTyping(false);
                }, 3000);
              }
              return;
            }

            const newMsg: ChatMessage = {
              id: textMsg.id || String(Date.now() + Math.random()),
              from: textMsg.from || "Unknown",
              msg: textMsg.msg || "",
              chatType:
                (textMsg.chatType as "singleChat" | "groupChat") ||
                "singleChat",
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              isSelf: false,
              isRead: false,
            };
            setMessages((prev) => [...prev, newMsg]);
            fetchConversations();
            markConversationAsRead(currentRecip.id, currentRecip.type);
          },
          onError: (error: AgoraChat.ErrorEvent) => {
            if (error?.type === 206) {
              // User already logged in on another device/tab error, ignore reconnect loop
              return;
            }
            setStatus("Error");
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
        setStatus("Error");
        setErrorMessage(formatError(err));
      }
    },
    [appId, apiUrl, fetchConversations, markConversationAsRead],
  );

  useEffect(() => {
    if (!isMounted) return;
    if (!currentUser) {
      router.push("/login");
      return;
    }
    queueMicrotask(() => {
      fetchUserDirectory();
      fetchConversations();
      if (connectedUserRef.current !== currentUser.username) {
        connectAgoraChat(currentUser.username);
      }
    });
  }, [
    isMounted,
    router,
    currentUser,
    fetchUserDirectory,
    fetchConversations,
    connectAgoraChat,
  ]);

  useEffect(() => {
    if (!isLoadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isLoadingMore]);

  useEffect(() => {
    return () => {
      if (connRef.current) {
        try {
          connRef.current.removeEventHandler("AGORA_CHAT_HANDLER");
          connRef.current.close();
          connRef.current = null;
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const sendTypingSignal = async () => {
    if (
      activeRecipient.type !== "singleChat" ||
      status !== "Connected" ||
      !connRef.current ||
      !currentUser
    )
      return;

    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return;
    lastTypingSentRef.current = now;

    try {
      const SDK = await getAgoraChatSDK();
      const option = {
        type: "txt" as const,
        msg: "__TYPING__",
        to: activeRecipient.id,
        chatType: "singleChat" as const,
      };
      const msg = SDK.message.create(option);
      await connRef.current.send(msg);
    } catch {
      // ignore
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    sendTypingSignal();
  };

  const handleLogout = () => {
    if (connRef.current) {
      try {
        connRef.current.removeEventHandler("AGORA_CHAT_HANDLER");
        connRef.current.close();
        connRef.current = null;
      } catch {
        // ignore
      }
    }
    localStorage.removeItem("currentUser");
    localStorage.removeItem("agoraToken");
    router.push("/login");
  };

  const sendMessage = async () => {
    if (!text.trim() || !currentUser) return;
    if (text.length > 2000) {
      setErrorMessage("Message length cannot exceed 2000 characters.");
      return;
    }

    setErrorMessage(null);
    const msgText = text.trim();

    try {
      if (status === "Connected" && connRef.current) {
        const SDK = await getAgoraChatSDK();
        const option = {
          type: "txt" as const,
          msg: msgText,
          to: activeRecipient.id,
          chatType: activeRecipient.type,
        };
        const msg = SDK.message.create(option);
        await connRef.current.send(msg);
      }

      const dbRes = await fetch(`${apiUrl}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          senderUsername: currentUser.username,
          recipientId: activeRecipient.id,
          chatType: activeRecipient.type,
          content: msgText,
        }),
      });

      let newDbMsg: ChatMessage | null = null;
      if (dbRes.ok) {
        const saved = await dbRes.json();
        newDbMsg = {
          id: saved.id,
          senderId: saved.senderId,
          from: saved.senderUsername,
          msg: saved.content,
          chatType: saved.chatType,
          timestamp: new Date(saved.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isSelf: true,
          isEdited: false,
          isDeleted: false,
          isRead: false,
        };
      }

      const optimisticMsg: ChatMessage = newDbMsg || {
        id: String(Date.now()),
        senderId: currentUser.id,
        from: currentUser.username,
        msg: msgText,
        chatType: activeRecipient.type,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isSelf: true,
        isRead: false,
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setText("");
      fetchConversations();
    } catch (err: unknown) {
      setErrorMessage("Failed to send message: " + formatError(err));
    }
  };

  const handleEditMessage = async (msgId: string) => {
    if (!editText.trim() || !currentUser) return;
    try {
      const res = await fetch(
        `${apiUrl}/messages/${msgId}?senderId=${currentUser.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editText.trim() }),
        },
      );
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, msg: editText.trim(), isEdited: true } : m,
          ),
        );
        setEditingMsgId(null);
        setEditText("");
        fetchConversations();
      } else {
        const err = await res.json();
        setErrorMessage(err.message || "Failed to edit message.");
      }
    } catch {
      setErrorMessage("Error updating message.");
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${apiUrl}/messages/${msgId}?senderId=${currentUser.id}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, msg: "This message was deleted", isDeleted: true }
              : m,
          ),
        );
        fetchConversations();
      } else {
        const err = await res.json();
        setErrorMessage(err.message || "Failed to delete message.");
      }
    } catch {
      setErrorMessage("Error deleting message.");
    }
  };

  const handleSaveBio = async () => {
    if (!currentUser) return;
    setIsSavingBio(true);
    try {
      const res = await fetch(`${apiUrl}/users/${currentUser.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: editBioText.trim() }),
      });
      if (res.ok) {
        const updated = (await res.json()) as UserProfile;
        setCurrentUser(updated);
        localStorage.setItem("currentUser", JSON.stringify(updated));
        if (selectedProfileUser?.id === currentUser.id) {
          setSelectedProfileUser(updated);
        }
        fetchUserDirectory();
      }
    } catch {
      // ignore
    } finally {
      setIsSavingBio(false);
    }
  };

  const getSidebarSummary = (recipientId: string) => {
    return conversations.find((c) => c.id === recipientId);
  };

  const activeContactUser = userDirectory.find((u) => u.username === activeRecipient.id);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        {/* User Profile Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div
            onClick={() => {
              if (currentUser) {
                setSelectedProfileUser(currentUser);
                setEditBioText(currentUser.bio || "");
                setIsProfileModalOpen(true);
              }
            }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div
              style={{ backgroundColor: currentUser?.avatarColor || "#3B82F6" }}
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow group-hover:opacity-90 transition"
            >
              {currentUser?.username?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="overflow-hidden">
              <h2 className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition">
                {currentUser?.username || "User"}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status === "Connected" ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span className="text-[11px] text-slate-400">{status}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Channels
            </h3>
            {(() => {
              const summary = getSidebarSummary("global_group");
              const unread = summary?.unreadCount || 0;
              return (
                <button
                  onClick={() => {
                    setActiveRecipient({
                      id: "global_group",
                      name: "Global Group Chat",
                      type: "groupChat",
                    });
                    setIsRecipientTyping(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left cursor-pointer ${
                    activeRecipient.id === "global_group"
                      ? "bg-blue-600 text-white font-medium shadow-lg shadow-blue-900/30"
                      : "hover:bg-slate-800/80 text-slate-300"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-900/50 border border-purple-700/50 flex items-center justify-center text-purple-300 font-bold text-xs">
                    #
                  </div>
                  <div className="flex-1 truncate">
                    <p className="text-xs font-semibold">Global Group Chat</p>
                    <p className="text-[10px] opacity-80 truncate">
                      {summary?.lastMessage || "Broadcast to all users"}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="bg-rose-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })()}
          </div>

          <div>
            <div className="flex items-center justify-between px-3 mb-2">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Direct Messages
              </h3>
              <button
                onClick={() => {
                  fetchUserDirectory();
                  fetchConversations();
                }}
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
                      onClick={() => {
                        setActiveRecipient({
                          id: u.username,
                          name: u.username,
                          type: "singleChat",
                        });
                        setIsRecipientTyping(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white font-medium shadow-lg shadow-blue-900/30"
                          : "hover:bg-slate-800/80 text-slate-300"
                      }`}
                    >
                      <div className="relative">
                        <div
                          style={{ backgroundColor: u.avatarColor || "#3B82F6" }}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                        >
                          {u.username[0]?.toUpperCase()}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                            u.isOnline ? "bg-emerald-400" : "bg-slate-500"
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
                          {summary?.lastMessage || (u.bio ? u.bio : "Click to message")}
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

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-slate-950">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 flex items-center justify-between shrink-0">
          <div
            onClick={() => {
              if (activeContactUser) {
                setSelectedProfileUser(activeContactUser);
                setIsProfileModalOpen(true);
              }
            }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div
              style={{
                backgroundColor:
                  activeRecipient.type === "groupChat"
                    ? "#581C87"
                    : activeContactUser?.avatarColor || "#1E40AF",
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white border border-slate-700/50 shadow"
            >
              {activeRecipient.type === "groupChat"
                ? "#"
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
                ) : activeRecipient.type === "groupChat" ? (
                  "Group Channel"
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

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="bg-rose-950/90 border-b border-rose-800 px-6 py-2 text-rose-200 text-xs flex items-center justify-between">
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="font-bold hover:text-white ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Message Feed */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950"
        >
          {hasMore && (
            <div className="text-center py-2">
              <button
                onClick={loadOlderMessages}
                disabled={isLoadingMore}
                className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white px-4 py-1.5 rounded-full text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                {isLoadingMore
                  ? "Loading older messages..."
                  : "↑ Load older messages"}
              </button>
            </div>
          )}

          {isLoadingHistory ? (
            <div className="text-center text-slate-500 py-12 text-sm">
              Loading message history...
            </div>
          ) : messages.length === 0 ? (
            <div className="my-auto text-center text-slate-500 py-20">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-600">
                💬
              </div>
              <p className="text-sm font-medium">
                No messages in this chat yet.
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Send a message to start the conversation!
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"} group`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-xs font-semibold text-slate-300">
                    {msg.isSelf ? "You" : msg.from}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {msg.timestamp}
                  </span>
                  {msg.isEdited && !msg.isDeleted && (
                    <span className="text-[10px] text-slate-500 italic">
                      (edited)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 max-w-md">
                  {msg.isSelf && !msg.isDeleted && editingMsgId !== msg.id && (
                    <div className="hidden group-hover:flex items-center gap-1 text-slate-400">
                      <button
                        onClick={() => {
                          setEditingMsgId(msg.id);
                          setEditText(msg.msg);
                        }}
                        title="Edit message"
                        className="p-1 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer text-xs"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        title="Delete message"
                        className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer text-xs"
                      >
                        🗑️
                      </button>
                    </div>
                  )}

                  {editingMsgId === msg.id ? (
                    <div className="flex flex-col gap-2 bg-slate-900 border border-blue-600 p-3 rounded-2xl w-full">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2 text-xs">
                        <button
                          onClick={() => setEditingMsgId(null)}
                          className="px-2 py-1 text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleEditMessage(msg.id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm wrap-break-word shadow-md flex items-end gap-2 ${
                        msg.isDeleted
                          ? "bg-slate-900/60 text-slate-500 italic border border-slate-800/60"
                          : msg.isSelf
                            ? "bg-blue-600 text-white rounded-tr-none"
                            : "bg-slate-900 text-slate-100 border border-slate-800 rounded-tl-none"
                      }`}
                    >
                      <span>{msg.msg}</span>
                      {msg.isSelf && !msg.isDeleted && (
                        <span
                          className={`text-[11px] font-bold shrink-0 ${
                            msg.isRead ? "text-cyan-300" : "text-blue-200 opacity-70"
                          }`}
                        >
                          {msg.isRead ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
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
              onChange={handleInputChange}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium px-6 py-3 rounded-xl text-sm transition shadow-lg shadow-blue-900/30 flex items-center gap-2 cursor-pointer"
            >
              <span>Send</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </form>
        </div>
      </main>

      {/* User Profile Modal */}
      {isProfileModalOpen && selectedProfileUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">User Profile</h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col items-center text-center space-y-3">
              <div
                style={{
                  backgroundColor: selectedProfileUser.avatarColor || "#3B82F6",
                }}
                className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg"
              >
                {selectedProfileUser.username[0]?.toUpperCase()}
              </div>

              <div>
                <h4 className="text-base font-bold text-white">
                  {selectedProfileUser.username}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatLastSeen(
                    selectedProfileUser.lastSeen,
                    selectedProfileUser.isOnline,
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">
                  Account Created
                </span>
                <span className="text-slate-200">
                  {selectedProfileUser.createdAt
                    ? new Date(selectedProfileUser.createdAt).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "long", day: "numeric" },
                      )
                    : "Joined recently"}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <span className="text-slate-500 font-semibold block uppercase tracking-wider text-[10px]">
                  Bio / Status
                </span>
                {selectedProfileUser.id === currentUser?.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editBioText}
                      onChange={(e) => setEditBioText(e.target.value)}
                      placeholder="Write something about yourself..."
                      rows={3}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleSaveBio}
                      disabled={isSavingBio}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg text-xs transition cursor-pointer"
                    >
                      {isSavingBio ? "Saving..." : "Save Bio"}
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-300 italic">
                    {selectedProfileUser.bio || "No status set."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
