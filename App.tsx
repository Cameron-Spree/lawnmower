
import React, { useState, useEffect, useRef } from 'react';
import { Chat } from '@google/genai';
import { ChatMessageData } from './types';
import { createChatSession, sendMessageToBot, addDebugLog, getAndClearDebugLogs, LogEntry } from './services/geminiService';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import Spinner from './components/Spinner';
import UserIdModal from './components/UserIdModal'; // Import the new modal

const examplePromptsArray = [
  "What's best for a small, hilly lawn?",
  "Show me petrol mowers with a rear roller",
  "I need a cordless mower for a medium garden",
  "Compare robotic vs traditional mowers"
];

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For message sending
  const [error, setError] = useState<string | null>(null);
  const [showInitialPrompts, setShowInitialPrompts] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);  
  // State for User ID and Session ID
  const [userId, setUserId] = useState<string>('');
  const [sessionId] = useState<string>(() => Date.now().toString(36) + Math.random().toString(36).substring(2));

  // States for initialization flow
  const [showUserIdModal, setShowUserIdModal] = useState<boolean>(true);
  const [isChatInitializing, setIsChatInitializing] = useState<boolean>(false);
  const [chatInitialized, setChatInitialized] = useState<boolean>(false);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const submitDebugLogsToServer = async (logsToSubmit: LogEntry[], currentSessionId: string, currentUserId: string) => {
    if (logsToSubmit.length === 0 || !currentSessionId) return;
    
    // User ID should be present if modal was submitted
    if (!currentUserId) {
        addDebugLog("WARN", `User ID is missing for debug log submission. Session: ${currentSessionId}. This should not happen after modal submission.`);
        // Fallback or skip if userId is critical for backend
    }

    const payload = {
      logs: logsToSubmit,
      sessionId: currentSessionId,
      userId: currentUserId || `UnknownUserAtSubmit-${currentSessionId.slice(-6)}`, 
    };

    try {
      addDebugLog("DEBUG", `Submitting ${logsToSubmit.length} debug logs to server for session ${currentSessionId}, user ${payload.userId}.`);
      const response = await fetch('https://lawnmower-backend.vercel.app/api/submit-debug-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        addDebugLog("INFO", "Debug logs successfully submitted to server.");
      } else {
        const errorText = await response.text();
        addDebugLog("ERROR", `Failed to submit debug logs to server. Status: ${response.status}. Response: ${errorText.substring(0, 100)}`);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      addDebugLog("ERROR", `Exception during debug log submission: ${errorMessage}`);
    }
  };

  useEffect(() => {
    // This effect runs once on mount. SessionId is already set.
    // The main purpose is to log that the app is waiting for User ID input.
    getAndClearDebugLogs(); // Clear any pre-existing logs
    addDebugLog("INFO", `App component mounted. Session ID: ${sessionId}. Awaiting User ID from modal.`);
  }, [sessionId]);


  const handleUserIdSubmit = async (submittedUserId: string) => {
    addDebugLog("INFO", `User ID submitted: "${submittedUserId}". Session ID: ${sessionId}. Proceeding with chat initialization.`);
    setUserId(submittedUserId);
    setShowUserIdModal(false);
    setIsChatInitializing(true);
    setChatInitialized(false);
    setError(null);
    getAndClearDebugLogs(); // Clear logs from before modal submission

    try {
      addDebugLog("INFO", `Chat initialization started. User: ${submittedUserId}, Session: ${sessionId}`);
      const session = createChatSession();
      setChatSession(session);
      setMessages([
        { 
          id: 'initial-bot-' + Date.now(), 
          text: `Hello ${submittedUserId}! I'm Briants Lawnmower Expert Bot. I'm here to help you find the perfect lawnmower. Tell me about your needs, or try a suggestion:`, 
          sender: 'bot', 
          timestamp: new Date(),
          initialPrompts: examplePromptsArray,
        }
      ]);
      setChatInitialized(true);
      addDebugLog("INFO", "Chat initialization successful.");
    } catch (e) {
      console.error("Failed to initialize chat session:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during initialization.";
      setError(`Could not initialize Briants Lawnmower Expert Bot. ${errorMessage}. Please ensure your API key is correctly configured and try refreshing the page.`);
      addDebugLog("ERROR", `Chat initialization failed: ${errorMessage}. User: ${submittedUserId}, Session: ${sessionId}`);
      setChatSession(null); 
    } finally {
      setIsChatInitializing(false);
      const initLogs = getAndClearDebugLogs();
      submitDebugLogsToServer(initLogs, sessionId, submittedUserId); 
    }
  };

  const handleSendMessage = async (inputText: string) => {
    if (!inputText.trim() || !chatSession || isLoading || !chatInitialized) return;

    setShowInitialPrompts(false); 
    getAndClearDebugLogs(); 
    addDebugLog("INFO", `User input: "${inputText}" (User: ${userId}, Session: ${sessionId})`);

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
      const botMessageText = response.text; 

      let textToDisplay = botMessageText;
      if (!botMessageText || botMessageText.trim() === "") {
        addDebugLog("WARN", "AI returned empty or whitespace-only text. Displaying fallback message.");
        textToDisplay = "I'm currently unable to provide a specific response. Could you please try rephrasing your request or ask something else?";
      } else {
        addDebugLog("INFO", `Displaying bot message: "${textToDisplay.substring(0,100)}${textToDisplay.length > 100 ? '...' : ''}"`)
      }

      const botMessage: ChatMessageData = { 
        id: 'bot-' + Date.now(), 
        text: textToDisplay, 
        sender: 'bot', 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (e) {
      console.error("Error sending message or receiving response:", e);
      const errorMessage = e instanceof Error ? e.message : "An unknown error occurred with the bot.";
      addDebugLog("ERROR", `Error in handleSendMessage: ${errorMessage}`);
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
      const interactionLogs = getAndClearDebugLogs();
      submitDebugLogsToServer(interactionLogs, sessionId, userId);
    }
  };
  
  const handlePromptClick = (promptText: string) => {
    handleSendMessage(promptText);
  };

  // Render Flows
  if (showUserIdModal) {
    return <UserIdModal onSubmit={handleUserIdSubmit} />;
  }

  if (isChatInitializing) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background text-textDark p-4">
        <Spinner />
        <p className="mt-4 text-lg">Initializing Briants Lawnmower Expert Bot for {userId}...</p>
      </div>
    );
  }
  
  if (error && !chatInitialized && !isChatInitializing) { 
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

  if (!chatInitialized) {
    // Fallback if somehow modal is closed, not initializing, but chat isn't ready (shouldn't happen with current logic)
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-background text-textDark p-4">
        <p className="text-lg">Preparing the application...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto bg-white shadow-2xl rounded-lg overflow-hidden my-0 md:my-4">
      <header className="bg-primary text-white p-4 text-center shadow-md">
        <h1 className="text-2xl font-bold">Briants Lawnmower Expert Bot</h1>
        <p className="text-sm opacity-90">User: {userId}</p>
      </header>

      <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <ChatMessage 
            key={msg.id} 
            message={msg}
            showInitialPrompts={showInitialPrompts && msg.sender === 'bot' && msg.initialPrompts && msg.initialPrompts.length > 0}
            onPromptClick={handlePromptClick}
          />
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

      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading || !chatInitialized} />
    </div>
  );
};

export default App;