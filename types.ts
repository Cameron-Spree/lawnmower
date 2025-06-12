
export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  imageUrl?: string; // Optional image URL
  attributes?: { [key: string]: string }; // Added for structured product attributes
}

export interface ChatMessageData {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}