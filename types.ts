
export interface Product {
  id: string;
  name: string;
  category: string; // Kept as it's used in current filtering; user may need to derive/add to DB
  price: number;
  description: string;
  imageUrl?: string;
  productUrl?: string; // New: Direct URL to the product page
  brand?: string; // New: e.g., Hayter, Honda, Stihl, Toro
  powerSource?: string; // New: e.g., Petrol, Battery, Electric
  driveType?: string; // New: e.g., Auto-Drive, Push
  cuttingWidthCm?: number; // New: e.g., 40, 56
  hasRearRoller?: boolean | string; // New: true or false, or "true"/"false" as string
  configuration?: string; // New: e.g., Rear Roller, 4 Wheel (was in attributes)
  batterySystem?: string; // New: e.g., STIHL AP System, HONDA Universal Battery System
  idealFor?: string; // New: Text describing ideal usage scenarios
  bestFeature?: string; // New: Text highlighting a key selling point
  attributes?: { [key: string]: string }; // For any other miscellaneous or less common attributes
}

export interface ChatMessageData {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  initialPrompts?: string[]; // Optional: For the first bot message to suggest user actions
}