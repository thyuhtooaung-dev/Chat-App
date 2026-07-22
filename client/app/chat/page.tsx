"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  UserProfile,
  ChatMessage,
  ConversationSummary,
  Recipient,
} from "../../types/chat";
import {
  fetchUserDirectory,
  fetchConversations,
  fetchMessagesHistory,
  saveMessageToDB,
  updateMessageInDB,
  deleteMessageInDB,
  markMessagesAsRead,
  sendUserHeartbeat,
  updateUserProfileBio,
} from "../../services/api";
import { useAgoraChat } from "../../hooks/useAgoraChat";
import { Sidebar } from "../../components/chat/Sidebar";
import { ChatHeader } from "../../components/chat/ChatHeader";
import { MessageFeed } from "../../components/chat/MessageFeed";
import { MessageInput } from "../../components/chat/MessageInput";
import { UserProfileModal } from "../../components/modals/UserProfileModal";

export default function ChatPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [activeRecipient, setActiveRecipient] = useState<Recipient>({
    id: "global_group",
    name: "Global Group Chat",
    type: "groupChat",
  });

  const [userDirectory, setUserDirectory] = useState<UserProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selectedProfileUser, setSelectedProfileUser] = useState<UserProfile | null>(null);
  const [editBioText, setEditBioText] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

  useEffect(() => {
    queueMicrotask(() => {
      setIsMounted(true);
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
        } catch {
          localStorage.removeItem("currentUser");
        }
      }
    });
  }, []);

  const loadDirectory = useCallback(async () => {
    try {
      const data = await fetchUserDirectory();
      setUserDirectory(data);
    } catch {
      // ignore
    }
  }, []);

  const loadConversationsList = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await fetchConversations(currentUser.id, currentUser.username);
      setConversations(data);
    } catch {
    }
  }, [currentUser]);

  const {
    status,
    errorMessage,
    setErrorMessage,
    connectAgoraChat,
    sendAgoraMessage,
    sendTypingSignal,
    sendReadSignal,
    connectedUserRef,
  } = useAgoraChat({
    appId,
    activeRecipient,
    onReceiveMessage: (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
      loadConversationsList();
      if (currentUser) {
        markMessagesAsRead(
          currentUser.id,
          currentUser.username,
          activeRecipient.id,
          activeRecipient.type,
        ).catch(() => {});
        sendReadSignal(activeRecipient.id, activeRecipient.type);
      }
    },
    onReceiveReadSignal: () => {
      setMessages((prev) =>
        prev.map((m) => (m.isSelf ? { ...m, isRead: true } : m)),
      );
    },
    onRecipientTyping: () => {
      setIsRecipientTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setIsRecipientTyping(false);
      }, 3000);
    },
  });

  useEffect(() => {
    if (!isMounted) return;
    if (!currentUser) {
      router.push("/login");
      return;
    }
    queueMicrotask(() => {
      loadDirectory();
      loadConversationsList();
      if (connectedUserRef.current !== currentUser.username) {
        connectAgoraChat(currentUser.username);
      }
    });
  }, [
    isMounted,
    router,
    currentUser,
    loadDirectory,
    loadConversationsList,
    connectAgoraChat,
    connectedUserRef,
  ]);

  useEffect(() => {
    if (!currentUser) return;
    let isSubscribed = true;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const data = await fetchMessagesHistory(
          currentUser.id,
          currentUser.username,
          activeRecipient.id,
          activeRecipient.type,
          undefined,
          50,
        );

        if (isSubscribed) {
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
          await markMessagesAsRead(
            currentUser.id,
            currentUser.username,
            activeRecipient.id,
            activeRecipient.type,
          );
          loadConversationsList();
          sendReadSignal(activeRecipient.id, activeRecipient.type);
        }
      } catch {
        if (isSubscribed) setErrorMessage("Failed to load message history.");
      } finally {
        setIsLoadingHistory(false);
      }
    };

    queueMicrotask(() => {
      loadHistory();
    });

    return () => {
      isSubscribed = false;
    };
  }, [
    activeRecipient.id,
    activeRecipient.type,
    currentUser,
    loadConversationsList,
    sendReadSignal,
    setErrorMessage,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      sendUserHeartbeat(currentUser.id).catch(() => {});
      loadDirectory();
      loadConversationsList();
      if (activeRecipient.type === "groupChat") {
        fetchMessagesHistory(
          currentUser.id,
          currentUser.username,
          activeRecipient.id,
          activeRecipient.type,
          undefined,
          50,
        )
          .then((data) => {
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
            setMessages((prev) => {
              if (
                prev.length === formatted.length &&
                prev[prev.length - 1]?.id === formatted[formatted.length - 1]?.id
              ) {
                return prev;
              }
              return formatted;
            });
          })
          .catch(() => {});
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [currentUser, activeRecipient, loadDirectory, loadConversationsList]);

  const handleLoadOlderMessages = async () => {
    if (!currentUser || messages.length === 0) return;
    setIsLoadingMore(true);
    try {
      const oldestId = messages[0].id;
      const data = await fetchMessagesHistory(
        currentUser.id,
        currentUser.username,
        activeRecipient.id,
        activeRecipient.type,
        oldestId,
        50,
      );

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
    } catch {
      setErrorMessage("Failed to load older messages.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentUser) return;

    const messageText = inputMessage.trim();
    setInputMessage("");

    const optimisticMsg: ChatMessage = {
      id: String(Date.now()),
      senderId: currentUser.id,
      from: currentUser.username,
      msg: messageText,
      chatType: activeRecipient.type,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isSelf: true,
      isRead: false,
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      await sendAgoraMessage(messageText, activeRecipient);
      const saved = await saveMessageToDB({
        senderId: currentUser.id,
        senderUsername: currentUser.username,
        recipientId: activeRecipient.id,
        chatType: activeRecipient.type,
        content: messageText,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMsg.id ? { ...m, id: saved.id } : m,
        ),
      );
      loadConversationsList();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to send message",
      );
    }
  };

  const handleInputChange = (val: string) => {
    setInputMessage(val);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      sendTypingSignal(activeRecipient.id, activeRecipient.type);
    }
  };

  const handleStartEditing = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditText(msg.msg);
  };

  const handleSaveEdit = async (msgId: string) => {
    if (!currentUser || !editText.trim()) return;
    try {
      await updateMessageInDB(msgId, currentUser.id, editText.trim());
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, msg: editText.trim(), isEdited: true } : m,
        ),
      );
      setEditingMessageId(null);
    } catch {
      setErrorMessage("Failed to edit message.");
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!currentUser) return;
    try {
      await deleteMessageInDB(msgId, currentUser.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? { ...m, msg: "This message was deleted", isDeleted: true }
            : m,
        ),
      );
    } catch {
      setErrorMessage("Failed to delete message.");
    }
  };

  const handleOpenProfile = (user: UserProfile) => {
    setSelectedProfileUser(user);
    setEditBioText(user.bio || "");
  };

  const handleOpenProfileByUsername = (username: string) => {
    const found = userDirectory.find((u) => u.username === username);
    if (found) {
      handleOpenProfile(found);
    } else {
      handleOpenProfile({ id: username, username });
    }
  };

  const handleSaveBio = async () => {
    if (!currentUser) return;
    setIsSavingBio(true);
    try {
      const updated = await updateUserProfileBio(currentUser.id, editBioText.trim());
      setCurrentUser(updated);
      setSelectedProfileUser(updated);
      localStorage.setItem("currentUser", JSON.stringify(updated));
      loadDirectory();
    } catch {
      setErrorMessage("Failed to save bio.");
    } finally {
      setIsSavingBio(false);
    }
  };

  const formatLastSeen = (lastSeen?: string, isOnline?: boolean) => {
    if (isOnline) return "Online";
    if (!lastSeen) return "Offline";
    const diffMin = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
    if (diffMin < 1) return "Last seen just now";
    if (diffMin < 60) return `Last seen ${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    return `Last seen ${Math.floor(diffHours / 24)}d ago`;
  };

  if (!isMounted) return null;

  const activeContactUser = userDirectory.find(
    (u) => u.username === activeRecipient.id,
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden">
      <Sidebar
        currentUser={currentUser}
        status={status}
        userDirectory={userDirectory}
        conversations={conversations}
        activeRecipient={activeRecipient}
        onSelectRecipient={(recip) => setActiveRecipient(recip)}
        onOpenProfile={handleOpenProfile}
        onRefreshDirectory={loadDirectory}
        onLogout={() => {
          localStorage.removeItem("currentUser");
          router.push("/login");
        }}
        formatLastSeen={formatLastSeen}
      />

      <main className="flex-1 flex flex-col h-full bg-slate-950 relative">
        {errorMessage && (
          <div className="bg-rose-900/80 border-b border-rose-700 text-rose-200 text-xs px-4 py-2 flex justify-between items-center z-20">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-300 hover:text-white font-bold ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        <ChatHeader
          activeRecipient={activeRecipient}
          activeContactUser={activeContactUser}
          isRecipientTyping={isRecipientTyping}
          onOpenProfile={handleOpenProfile}
          formatLastSeen={formatLastSeen}
        />

        <MessageFeed
          isLoadingHistory={isLoadingHistory}
          isLoadingMore={isLoadingMore}
          hasMore={hasMore}
          messages={messages}
          editingMessageId={editingMessageId}
          editText={editText}
          scrollContainerRef={scrollContainerRef}
          messagesEndRef={messagesEndRef}
          onLoadOlderMessages={handleLoadOlderMessages}
          onSetEditText={(txt) => setEditText(txt)}
          onStartEditing={handleStartEditing}
          onCancelEditing={() => setEditingMessageId(null)}
          onSaveEdit={handleSaveEdit}
          onDeleteMessage={handleDeleteMessage}
          onOpenProfileByUsername={handleOpenProfileByUsername}
          userDirectory={userDirectory}
        />

        <MessageInput
          inputMessage={inputMessage}
          onInputChange={handleInputChange}
          onSendMessage={handleSendMessage}
          status={status}
        />
      </main>

      <UserProfileModal
        selectedProfileUser={selectedProfileUser}
        currentUser={currentUser}
        editBioText={editBioText}
        isSavingBio={isSavingBio}
        onClose={() => setSelectedProfileUser(null)}
        onSetEditBioText={(txt) => setEditBioText(txt)}
        onSaveBio={handleSaveBio}
        formatLastSeen={formatLastSeen}
      />
    </div>
  );
}
