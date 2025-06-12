
import React from 'react';
import { ChatMessageData } from '../types';

interface ChatMessageProps {
  message: ChatMessageData;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  // Basic markdown-like formatting for paragraphs and newlines
  const formatText = (text: string) => {
    return text.split('\n').map((paragraph, index) => (
      <p key={index} className="mb-1 last:mb-0">
        {paragraph}
      </p>
    ));
  };

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xl lg:max-w-2xl px-4 py-3 rounded-lg shadow-md ${
          isUser ? 'bg-primary text-white rounded-br-none' : 'bg-white text-textDark rounded-bl-none'
        }`}
      >
        <div className="prose prose-sm max-w-none text-inherit">
             {formatText(message.text)}
        </div>
        <p className={`text-xs mt-2 ${isUser ? 'text-gray-300' : 'text-textLight'} text-right`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
