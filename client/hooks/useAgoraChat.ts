import { useState, useRef, useCallback, useEffect } from "react";
import type AgoraChat from "agora-chat";
import { ConnectionStatus, Recipient, ChatMessage } from "../types/chat";
import { getAgoraChatSDK } from "../services/agora";
import { fetchAgoraToken } from "../services/api";

export interface TextMsgBody {
  id?: string;
  msg?: string;
  from?: string;
  chatType?: string;
  to?: string;
  type?: string;
}

export interface ErrorEvent {
  type?: number;
  message?: string;
  data?: unknown;
}

type AgoraConnection = InstanceType<typeof AgoraChat.connection>;

interface UseAgoraChatProps {
  appId: string;
  activeRecipient: Recipient;
  onReceiveMessage?: (newMsg: ChatMessage) => void;
  onReceiveReadSignal?: (fromUser: string) => void;
  onRecipientTyping?: (fromUser: string) => void;
}

export const useAgoraChat = ({
  appId,
  activeRecipient,
  onReceiveMessage,
  onReceiveReadSignal,
  onRecipientTyping,
}: UseAgoraChatProps) => {
  const [status, setStatus] = useState<ConnectionStatus>("Disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeRecipientRef = useRef(activeRecipient);
  useEffect(() => {
    activeRecipientRef.current = activeRecipient;
  }, [activeRecipient]);

  const onReceiveMessageRef = useRef(onReceiveMessage);
  useEffect(() => {
    onReceiveMessageRef.current = onReceiveMessage;
  }, [onReceiveMessage]);

  const onReceiveReadSignalRef = useRef(onReceiveReadSignal);
  useEffect(() => {
    onReceiveReadSignalRef.current = onReceiveReadSignal;
  }, [onReceiveReadSignal]);

  const onRecipientTypingRef = useRef(onRecipientTyping);
  useEffect(() => {
    onRecipientTypingRef.current = onRecipientTyping;
  }, [onRecipientTyping]);

  const connectedUserRef = useRef<string | null>(null);
  const connRef = useRef<AgoraConnection | null>(null);

  const formatError = (err: unknown): string => {
    if (typeof err === "string") return err;
    if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: unknown }).message);
    }
    return JSON.stringify(err);
  };

  const connectAgoraChat = useCallback(
    async (username: string) => {
      if (!appId) {
        setErrorMessage(
          "NEXT_PUBLIC_AGORA_APP_ID is not configured in environment.",
        );
        return;
      }

      if (connectedUserRef.current === username && connRef.current) {
        return;
      }

      setStatus("Connecting");
      setErrorMessage(null);

      try {
        const SDK = await getAgoraChatSDK();
        const token = await fetchAgoraToken(username);

        if (connRef.current) {
          try {
            connRef.current.removeEventHandler("AGORA_CHAT_HANDLER");
            connRef.current.close();
          } catch {
            // ignore
          }
          connRef.current = null;
        }

        const connParams = appId.includes("#")
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
          onTextMessage: (message: TextMsgBody) => {
            const textMsg = message as TextMsgBody & {
              from?: string;
              chatType?: string;
            };

            const currentRecip = activeRecipientRef.current;

            if (textMsg.msg === "__TYPING__") {
              if (
                textMsg.from === currentRecip.id &&
                onRecipientTypingRef.current
              ) {
                onRecipientTypingRef.current(textMsg.from);
              }
              return;
            }

            if (textMsg.msg === "__READ__") {
              if (
                textMsg.from === currentRecip.id &&
                onReceiveReadSignalRef.current
              ) {
                onReceiveReadSignalRef.current(textMsg.from);
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

            if (onReceiveMessageRef.current) {
              onReceiveMessageRef.current(newMsg);
            }
          },
          onError: (error: ErrorEvent) => {
            if (error?.type === 206) {
              return;
            }
            setStatus("Error");
            setErrorMessage(formatError(error));
          },
        });

        try {
          await conn.open({ user: username, accessToken: token });
        } catch (openErr: unknown) {
          try {
            await conn.registerUser({
              username: username,
              password: `Pass_${username}_123`,
            });
            await conn.open({ user: username, accessToken: token });
          } catch {
            throw openErr;
          }
        }
      } catch (err: unknown) {
        setStatus("Error");
        setErrorMessage(formatError(err));
      }
    },
    [appId],
  );

  const sendAgoraMessage = useCallback(
    async (text: string, recipient: Recipient) => {
      if (!connRef.current || status !== "Connected") {
        throw new Error("Chat server is not connected");
      }

      const SDK = await getAgoraChatSDK();
      const option = {
        type: "txt" as const,
        msg: text,
        to: recipient.id,
        chatType: recipient.type,
      };

      const msg = SDK.message.create(option);
      return await connRef.current.send(msg);
    },
    [status],
  );

  const sendTypingSignal = useCallback(
    async (recipientId: string, chatType: "singleChat" | "groupChat") => {
      if (
        chatType !== "singleChat" ||
        status !== "Connected" ||
        !connRef.current
      )
        return;

      try {
        const SDK = await getAgoraChatSDK();
        const option = {
          type: "txt" as const,
          msg: "__TYPING__",
          to: recipientId,
          chatType: "singleChat" as const,
        };
        const msg = SDK.message.create(option);
        await connRef.current.send(msg);
      } catch {
        // ignore
      }
    },
    [status],
  );

  const sendReadSignal = useCallback(
    async (recipientId: string, chatType: "singleChat" | "groupChat") => {
      if (
        chatType !== "singleChat" ||
        status !== "Connected" ||
        !connRef.current
      )
        return;

      try {
        const SDK = await getAgoraChatSDK();
        const option = {
          type: "txt" as const,
          msg: "__READ__",
          to: recipientId,
          chatType: "singleChat" as const,
        };
        const msg = SDK.message.create(option);
        await connRef.current.send(msg);
      } catch {
        // ignore
      }
    },
    [status],
  );

  return {
    status,
    errorMessage,
    setErrorMessage,
    connectAgoraChat,
    sendAgoraMessage,
    sendTypingSignal,
    sendReadSignal,
    connectedUserRef,
  };
};
