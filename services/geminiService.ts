
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionDeclaration, Part, Type, FunctionCall, Content, SendMessageParameters } from "@google/genai";
import { MOCK_PRODUCTS } from '../constants';
import { Product } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set. Please configure process.env.API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

// --- Tool Definition for Product Search ---
const findProductsTool: FunctionDeclaration = {
  name: "findProducts",
  description: "Searches the lawnmower catalog for relevant products. Use this to find specific lawnmowers or a list of lawnmowers matching certain criteria to answer user queries or make recommendations. Always call this tool if you need to list or suggest lawnmowers.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      keywords: {
        type: Type.STRING,
        description: "Keywords to search for in lawnmower names, descriptions, and categories (e.g., 'petrol rear roller', 'cordless small lawn', 'robotic mower'). Can be multiple words. Be as descriptive as possible based on user needs.",
      },
      category: {
        type: Type.STRING,
        description: "Optional: The specific category of lawnmowers to filter by (e.g., 'Petrol Rotary Mowers', 'Robotic Mowers'). Terms from this category will be treated as additional keywords.",
      },
      productId: {
        type: Type.STRING,
        description: "Optional: A specific lawnmower product ID to look up (e.g., 'S00024575'). If provided, other parameters might be less critical.",
      },
      attributeFilters: { // Added attributeFilters
        type: Type.OBJECT,
        description: "Optional: An object containing key-value pairs for filtering by specific product attributes. For example, {'Brand': 'Honda', 'Power Source': 'Petrol'}. Use attributes the user mentions or that are relevant to their needs.",
        properties: { // It's good practice to define potential attributes if known, but not strictly required for OBJECT type
          Brand: { type: Type.STRING, description: "e.g., Hayter, Honda, Stihl, Toro" },
          'Power Source': { type: Type.STRING, description: "e.g., Petrol, Battery, Electric" },
          'Cutting Width': { type: Type.STRING, description: "e.g., 16 inch (40cm), 22 inch (56cm)" },
          'Drive Type': { type: Type.STRING, description: "e.g., Auto-Drive, Push" },
          'Configuration': { type: Type.STRING, description: "e.g., Rear Roller, 4 Wheel" }
        },
      }
    },
    required: [],
  },
};

// --- System Instruction ---
const SYSTEM_INSTRUCTION = `You are "Briants Lawnmower Expert Bot", a specialist AI assistant from Briants.
Your primary role is to help users choose the perfect lawnmower from our range by providing expert advice and product recommendations.
You have a tool called "findProducts" that allows you to search our comprehensive lawnmower catalog. This tool returns product details including name, description, category, price, specific attributes (like Brand, Power Source, Cutting Width), and an image URL.

ALWAYS use the "findProducts" tool when a user asks about lawnmowers, needs recommendations, or if their query implies needing lawnmower information.
Do not list lawnmowers or make them up from memory; use the tool to get up-to-date information.

Before recommending, try to understand the user's needs by asking clarifying questions, such as:
- "What is the approximate size of your lawn?"
- "Do you have a preference for power type (petrol, electric, battery, robotic)?"
- "Are there specific features you're looking for (self-propelled, rear roller, mulching, cutting width)?"
- "Any brand preferences (Hayter, Stihl, Honda, Toro)?"

Guidelines for using the "findProducts" tool:
1.  **Keywords**: Use strong, descriptive keywords in the 'keywords' parameter.
2.  **Category**: Use the 'category' parameter if a specific type is mentioned. Terms from this category will be treated as additional keywords.
3.  **Attribute Filters**: Use the 'attributeFilters' parameter to narrow down results based on specific features the user wants (e.g., attributeFilters: {"Brand": "Honda", "Power Source": "Petrol"}).
4.  **Product ID**: Use 'productId' for specific ID lookups.

When presenting products found by the tool:
1.  **Name & Image**: Clearly state the product name (make it bold with **Product Name**) and include its image URL in the format (Image: [URL_HERE]) if available.
2.  **Description**: Briefly describe the product.
3.  **Key Attributes**: Mention a few key relevant attributes from the product data (e.g., "Key Features: Brand: Honda, Cutting Width: 18 inch, Power: Petrol.").
4.  **Why it Matches**: Explain why it's a good match for the user.
5.  **If No Products Found**: Politely say so and ask the user to rephrase or suggest different features.

General Guidelines:
- Maintain a knowledgeable, friendly, and helpful tone.
- If a user asks about something unrelated to lawnmowers, politely steer the conversation back.
- No prices unless asked and available from the tool.
`;

const commonStopWords = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "should",
  "can", "could", "may", "might", "must", "of", "to", "in", "on", "at",
  "for", "with", "by", "from", "up", "down", "out", "over", "under",
  "again", "further", "then", "once", "here", "there", "when", "where",
  "why", "how", "all", "any", "both", "each", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same",
  "so", "than", "too", "very", "s", "t", "just", "don", "now", "i", "me",
  "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours",
  "yourself", "yourselves", "he", "him", "his", "himself", "she", "her",
  "hers", "herself", "it", "its", "itself", "they", "them", "their",
  "theirs", "themselves", "what", "which", "who", "whom", "this", "that",
  "these", "those", "am"
]);

const processKeywords = (inputString?: string): string[] => {
  if (!inputString) return [];
  return inputString.toLowerCase().split(/\s+/)
    .map(k => k.trim().replace(/[^\w\s-]/gi, '')) // allow hyphens
    .filter(k => k.length > 1 && !commonStopWords.has(k));
};


const executeFindProductsTool = (args: { 
    keywords?: string; 
    category?: string; 
    productId?: string; 
    attributeFilters?: { [key: string]: string };
  }): Partial<Product>[] => { // Return Partial<Product> as we select fields
  const { keywords, category, productId, attributeFilters } = args;
  console.log(`Executing findProducts tool with: productId='${productId}', keywords='${keywords}', category='${category}', attributeFilters:`, attributeFilters);
  
  let results: Product[] = MOCK_PRODUCTS;

  if (productId && productId.trim() !== "") {
    const productById = MOCK_PRODUCTS.find(p => p.id.toLowerCase() === productId.toLowerCase().trim());
    results = productById ? [productById] : [];
    console.log(`Found by ID (${productId}): ${results.length} products.`);
  } else {
    let effectiveSearchTerms: string[] = processKeywords(keywords);
    if (category && category.trim().toLowerCase() !== "uncategorized" && category.trim() !== "") {
      effectiveSearchTerms.push(...processKeywords(category));
    }
    effectiveSearchTerms = [...new Set(effectiveSearchTerms)];

    if (effectiveSearchTerms.length > 0) {
      console.log(`Filtering with processed keywords: ${effectiveSearchTerms.join(', ')}`);
      results = results.filter(p => {
        const productName = p.name.toLowerCase();
        const productDescription = p.description ? p.description.toLowerCase() : "";
        const productCategoryText = p.category ? p.category.toLowerCase() : "";
        return effectiveSearchTerms.every(term =>
          productName.includes(term) ||
          productDescription.includes(term) ||
          productCategoryText.includes(term)
        );
      });
    }

    if (attributeFilters && Object.keys(attributeFilters).length > 0) {
      console.log(`Filtering with attributes:`, attributeFilters);
      results = results.filter(p => {
        if (!p.attributes) return false;
        return Object.entries(attributeFilters).every(([key, value]) => {
          const productAttrValue = p.attributes![key];
          // Case-insensitive partial match for attribute values
          return productAttrValue && productAttrValue.toLowerCase().includes(value.toLowerCase());
        });
      });
    }
    
    if (effectiveSearchTerms.length === 0 && (!attributeFilters || Object.keys(attributeFilters).length === 0)) {
      console.warn("findProducts tool called with no effective search criteria (after processing and no Product ID). Returning empty.");
      results = [];
    }
  }
  
  console.log(`Found: ${results.length} products before slicing.`);
  
  return results.map(p => {
    let singleImageUrl: string | undefined = undefined;
    if (p.imageUrl) {
      singleImageUrl = p.imageUrl.split(',')[0].trim(); // Take the first image URL if multiple
    }
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      description: p.description ? p.description.substring(0, 250) + (p.description.length > 250 ? "..." : "") : "No description available.",
      attributes: p.attributes, // Include attributes
      imageUrl: singleImageUrl, // Include the single image URL
  }}).slice(0, 5); // Return up to 5 products to keep response concise
};

export const createChatSession = (): Chat => {
  if (!API_KEY) {
    throw new Error("Gemini API Key is not configured. Cannot create chat session.");
  }
  return ai.chats.create({
    model: 'gemini-2.5-flash-preview-04-17',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: [findProductsTool] }],
    },
  });
};

export const sendMessageToBot = async (chat: Chat, messageText: string): Promise<GenerateContentResponse> => {
  if (!API_KEY) {
    throw new Error("Gemini API Key is not configured. Cannot send message.");
  }

  const userMessageParams: SendMessageParameters = { message: messageText };
  let response = await chat.sendMessage(userMessageParams);

  const functionCalls: FunctionCall[] | undefined = response.functionCalls;

  if (functionCalls && functionCalls.length > 0) {
    const call: FunctionCall = functionCalls[0];
    if (call.name === 'findProducts') {
      const toolArgs = call.args as { 
          keywords?: string; 
          category?: string; 
          productId?: string; 
          attributeFilters?: { [key: string]: string };
      };
      console.log("Gemini requested to call 'findProducts' with args:", JSON.stringify(toolArgs, null, 2));
      const toolResult = executeFindProductsTool(toolArgs);
      console.log("'findProducts' tool executed. Result (up to 5):", JSON.stringify(toolResult, null, 2));

      const functionResponsePart: Part = {
        functionResponse: {
          name: 'findProducts',
          response: { products: toolResult }
        }
      };
      
      const functionResponseParams: SendMessageParameters = { message: [functionResponsePart] };
      response = await chat.sendMessage(functionResponseParams);

    } else {
        console.warn("Received unhandled function call:", call.name);
        const errorResponsePart: Part = {
          functionResponse: {
            name: call.name,
            response: { error: `Function ${call.name} is not implemented or recognized.`}
          }
        };
        const errorResponseParams: SendMessageParameters = { message: [errorResponsePart] };
        response = await chat.sendMessage(errorResponseParams);
    }
  }

  return response;
};