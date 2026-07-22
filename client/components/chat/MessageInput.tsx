import React from 'react';
import { Send } from 'lucide-react';
import { ConnectionStatus } from '../../types/chat';

interface MessageInputProps {
  inputMessage: string;
  onInputChange: (val: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  status: ConnectionStatus;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  inputMessage,
  onInputChange,
  onSendMessage,
  status,
}) => {
  return (
    <footer className="p-4 bg-slate-900 border-t border-slate-800 shrink-0">
      <form onSubmit={onSendMessage} className="flex gap-3 max-w-5xl mx-auto">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={
            status === 'Connected'
              ? 'Type a message...'
              : 'Connecting to chat server...'
          }
          disabled={status !== 'Connected'}
          maxLength={2000}
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status !== 'Connected' || !inputMessage.trim()}
          className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl text-xs shadow-lg shadow-blue-900/30 transition cursor-pointer shrink-0 flex items-center gap-2"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </footer>
  );
};
