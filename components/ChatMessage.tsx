
import React, { useRef } from 'react';
import { ChatMessageData } from '../types';
import ProductCard from './ProductCard'; 

interface ChatMessageProps {
  message: ChatMessageData;
  showInitialPrompts?: boolean;
  onPromptClick?: (promptText: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, showInitialPrompts, onPromptClick }) => {
  const isUser = message.sender === 'user';
  const internalKeyCounter = useRef(0);
  const getNextKey = () => internalKeyCounter.current++;

  const renderRegularParagraph = (paragraphText: string): JSX.Element => {
    const parts = paragraphText.split(/(\*\*.*?\*\*)/g).filter(part => part.length > 0);
    return (
      <p key={`text-p-${getNextKey()}`} className="mb-1 last:mb-0" style={{ whiteSpace: 'pre-line' }}> 
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={`bold-${index}`} className="text-base">{part.slice(2, -2)}</strong>;
          }
          return <React.Fragment key={`text-part-${index}`}>{part}</React.Fragment>;
        })}
      </p>
    );
  };
  
  const parseAndRenderContent = (text: string): JSX.Element[] => {
    const elements: JSX.Element[] = [];
    const lines = text.split('\n');
    let i = 0;
    let regularTextBuffer: string[] = [];

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim() === "--- START OF PRODUCT ---") {
        if (regularTextBuffer.length > 0) {
          elements.push(renderRegularParagraph(regularTextBuffer.join('\n')));
          regularTextBuffer = [];
        }

        const productData: { 
          name?: string; 
          sku?: string; 
          imageUrl?: string; 
          productUrl?: string; 
          description?: string;
          features?: string;
          priceString?: string; 
          reasoning?: string; // Added reasoning
        } = {};
        let currentLineIndex = i + 1;
        
        let collectedFeatures: string[] = [];
        let inFeaturesSection = false;

        console.log("[ChatMessage] Parsing new product block.");
        while (currentLineIndex < lines.length && lines[currentLineIndex].trim() !== "--- END OF PRODUCT ---") {
          const productLine = lines[currentLineIndex]; 
          const trimmedProductLine = productLine.trim();

          if (trimmedProductLine.startsWith('**Name**:')) {
            productData.name = trimmedProductLine.substring('**Name**:'.length).trim();
            inFeaturesSection = false;
          } else if (trimmedProductLine.startsWith('SKU:')) { 
            productData.sku = trimmedProductLine.substring('SKU:'.length).trim();
            inFeaturesSection = false;
          } else if (trimmedProductLine.startsWith('(Image:')) {
            const imageMatch = trimmedProductLine.match(/\(Image: (https?:\/\/[^\s)]+)\)/);
            if (imageMatch) productData.imageUrl = imageMatch[1];
            inFeaturesSection = false;
          } else if (trimmedProductLine.startsWith('(More info:')) {
            const linkMatch = trimmedProductLine.match(/\(More info: (https?:\/\/[^\s)]+)\)/);
            if (linkMatch) productData.productUrl = linkMatch[1];
            inFeaturesSection = false;
          } else if (trimmedProductLine.startsWith('Description:')) {
            productData.description = productLine.substring(productLine.indexOf('Description:') + 'Description:'.length).trimStart();
            inFeaturesSection = false;
          } else if (trimmedProductLine.startsWith('Features:')) {
            collectedFeatures.push(productLine.substring(productLine.indexOf('Features:') + 'Features:'.length).trimStart());
            inFeaturesSection = true;
          } else if (trimmedProductLine.startsWith('Price:')) {
            productData.priceString = trimmedProductLine; 
            inFeaturesSection = false;
          } else if (trimmedProductLine.startsWith('Reasoning:')) { // Parse Reasoning
            productData.reasoning = productLine.substring(productLine.indexOf('Reasoning:') + 'Reasoning:'.length).trimStart();
            inFeaturesSection = false;
            console.log(`[ChatMessage] Extracted reasoning: ${productData.reasoning}`);
          } else if (inFeaturesSection) {
            collectedFeatures.push(productLine); 
          } else {
            // console.warn(`[ChatMessage] Unexpected line in product block: ${productLine}`);
            // If it's not a known field and we are not in features, it might be part of a multi-line description, reasoning, etc.
            // For simplicity, current logic only assigns to description/reasoning/features if the line starts with the keyword.
            // Multi-line values for these fields would need more complex parsing logic (e.g. continuing to append to the last active field).
          }
          currentLineIndex++;
        }
        
        if (collectedFeatures.length > 0) {
            productData.features = collectedFeatures.join('\n').trim();
        }

        if (productData.name) { 
            elements.push(
              <ProductCard
                key={`product-${getNextKey()}`}
                name={productData.name}
                sku={productData.sku} 
                imageUrl={productData.imageUrl}
                productUrl={productData.productUrl}
                description={productData.description}
                features={productData.features}
                priceString={productData.priceString}
                reasoning={productData.reasoning} // Pass reasoning
              />
            );
        }
        i = currentLineIndex + 1; 
      } else {
        if (line.trim() !== "" || regularTextBuffer.length > 0 || (regularTextBuffer.length === 0 && line === "")) { 
            regularTextBuffer.push(line);
        }
        i++;
      }
    }
    
    if (regularTextBuffer.length > 0) { 
        elements.push(renderRegularParagraph(regularTextBuffer.join('\n')));
    }
    return elements;
  };

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xl lg:max-w-2xl px-4 py-3 rounded-lg shadow-md ${
          isUser ? 'bg-primary text-white rounded-br-none' : 'bg-white text-textDark rounded-bl-none'
        }`}
      >
        <div className="prose prose-sm max-w-none text-inherit">
             {isUser ? renderRegularParagraph(message.text) : parseAndRenderContent(message.text)}
        </div>

        {message.sender === 'bot' && message.initialPrompts && showInitialPrompts && onPromptClick && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex flex-wrap gap-2">
              {message.initialPrompts.map((prompt, index) => (
                <button
                  key={`prompt-${index}-${message.id}`}
                  onClick={() => onPromptClick(prompt)}
                  className="bg-gray-100 hover:bg-gray-200 text-primary font-medium py-1.5 px-3 rounded-full text-xs transition-colors border border-gray-300 shadow-sm"
                  aria-label={`Send prompt: ${prompt}`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className={`text-xs mt-2 ${isUser ? 'text-gray-300' : 'text-textLight'} text-right`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
};

export default ChatMessage;
