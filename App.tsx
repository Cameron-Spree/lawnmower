
import React, { useState, useEffect, useRef } from 'react';
import { Chat } from '@google/genai';
import { ChatMessageData } from './types';
import { createChatSession, sendMessageToBot } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import Spinner from './components/Spinner'; // Used for initial loading

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For message sending
  const [isInitializing, setIsInitializing] = useState(true); // For initial chat session setup
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const initializeChat = async () => {
      setIsInitializing(true);
      setError(null);
      try {
        const session = createChatSession();
        setChatSession(session);
        setMessages([
          { 
            id: 'initial-bot-' + Date.now(), 
            text: "Hello! I'm Briants Lawnmower Expert Bot. I'm here to help you find the perfect lawnmower from our range. To get started, tell me a bit about your lawn (e.g., size, type of grass) and what you're looking for. For example, 'What's best for a small, hilly lawn?' or 'Show me petrol mowers with a rear roller'.", 
            sender: 'bot', 
            timestamp: new Date() 
          }
        ]);
      } catch (e) {
        console.error("Failed to initialize chat session:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during initialization.";
        setError(`Could not initialize Briants Lawnmower Expert Bot. ${errorMessage}. Please ensure your API key is correctly configured and try refreshing the page.`);
        setChatSession(null); 
      } finally {
        setIsInitializing(false);
      }
    };

    initializeChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleSendMessage = async (inputText: string) => {
    if (!inputText.trim() || !chatSession || isLoading) return;

    const userMessage: ChatMessageData = { 
      id: 'user-' + Date.now(), 
      text: inputText, 
      sender: 'user', 
      timestamp: new Date() 
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendMessageToBot(chatSession, userMessage.text);
      // The 'text' property is a getter that extracts the text content.
      // It should be populated after any function calls are resolved by the model.
      const botMessageText = response.text; 

      if (botMessageText) {
        const botMessage: ChatMessageData = { 
          id: 'bot-' + Date.now(), 
          text: botMessageText, 
          sender: 'bot', 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        // This case might occur if the model responds with only a function call
        // and something unexpected happens, or if the final response is empty.
        console.warn("Received an empty text response from the bot after potential function calls.");
        const botMessage: ChatMessageData = { 
          id: 'bot-empty-' + Date.now(), 
          text: "I've processed your request. Is there anything else I can help with regarding lawnmowers?", 
          sender: 'bot', 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, botMessage]);
      }

    } catch (e) {
      console.error("Error sending message or receiving response:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred with the bot.";
      setError(`Briants Lawnmower Expert Bot encountered an issue: ${errorMessage}`);
      const errorBotMessage: ChatMessageData = {
        id: 'error-bot-' + Date.now(),
        text: `Sorry, I couldn't process that. ${errorMessage}. Please try again.`,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorBotMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background text-textDark p-4">
        <Spinner />
        <p className="mt-4 text-lg">Initializing Briants Lawnmower Expert Bot...</p>
        {error && <p className="mt-2 text-red-500 text-center max-w-md">{error}</p>}
      </div>
    );
  }
  
  if (error && !chatSession && !isInitializing) { 
     return (
      <div className="flex flex-col h-screen items-center justify-center bg-background text-textDark p-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-red-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.25-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
        </svg>
        <h1 className="text-2xl font-semibold mt-4">Initialization Failed</h1>
        <p className="mt-2 text-red-600 text-center max-w-md">{error}</p>
        <p className="mt-2 text-textLight text-center max-w-md">Please check your internet connection and API key configuration, then refresh the page.</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden my-0 md:my-8">
      <header className="bg-primary text-white p-4 text-center shadow-md">
        <h1 className="text-2xl font-bold">Briants Lawnmower Expert Bot</h1>
        <p className="text-sm opacity-90">Your AI companion for all things Briants Lawnmowers</p>
      </header>

      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && messages.length > 0 && messages[messages.length-1].sender === 'user' && (
          <div className="flex justify-start mb-4">
             <div className="max-w-xl lg:max-w-2xl px-4 py-3 rounded-lg shadow-md bg-white text-textDark rounded-bl-none">
                <div className="flex items-center space-x-2">
                    <Spinner /> <span>Briants Lawnmower Expert Bot is thinking...</span>
                </div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && !isLoading && ( 
        <div className="p-3 bg-red-100 text-red-700 text-sm text-center">
          Error: {error}
        </div>
      )}

      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};

export default App;