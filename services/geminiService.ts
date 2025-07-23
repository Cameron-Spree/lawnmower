
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionDeclaration, Part, Type, FunctionCall as GeminiFunctionCall } from "@google/genai"; // Renamed FunctionCall to avoid conflict
import { Product } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set. Please configure process.env.API_KEY.");
  // Consider throwing an error or having a fallback mechanism if critical
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

// --- Debug Logging ---
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}
let currentDebugLogs: LogEntry[] = [];

export const addDebugLog = (level: string, message: string) => {
  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
  const formattedTimestamp = `[${timeString}.${milliseconds}]`;
  const logEntry: LogEntry = {
    timestamp: formattedTimestamp,
    level: level.toUpperCase(), // Ensure level is uppercase
    message: message
  };
  console.log(`[DEBUG] ${logEntry.timestamp} [${logEntry.level}] ${logEntry.message}`); // Keep console logs too
  currentDebugLogs.push(logEntry);
};

export const getAndClearDebugLogs = (): LogEntry[] => {
  const logs = [...currentDebugLogs];
  currentDebugLogs = [];
  return logs;
};
// --- End Debug Logging ---


// --- Tool Definition for Product Search ---
const findProductsTool: FunctionDeclaration = {
  name: "findProducts",
  description: "Searches the Briants of Risborough lawnmower catalog for relevant products. Use this to find specific lawnmowers or a list of lawnmowers matching certain criteria to answer user queries or make recommendations. Always call this tool if you need to list or suggest lawnmowers. You can also use it to help users with budget constraints.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      keywords: {
        type: Type.STRING,
        description: "Relevant search terms. If specific filters (like powerSource, driveType) are used, keywords should be simple (e.g., 'lawnmower', 'mower'). For conceptual searches (e.g., 'large garden mower'), use 2-3 impactful keywords (e.g., 'powerful wide cutting') or prioritize mapping concepts to specific filters. Avoid overly long keyword strings (6+ words) as the backend requires all terms to match. When `maxPrice`/`minPrice` is set, focus keywords on product features/type; avoid 'budget' or 'affordable' if price range is already set.",
      },
      category: {
        type: Type.STRING,
        description: "Optional: The specific category of lawnmowers to filter by. For robotic mowers, use 'Robotic Lawnmower'. Other examples: 'Petrol Rotary Mowers', 'Cylinder Mowers', 'Battery Mowers', 'Electric Mowers'. If a user asks for a general type like 'petrol mowers' or 'battery mowers' and does not specify a more niche sub-type, default this to 'Lawnmower' and rely on the 'powerSource' filter and 'keywords'. If user asks for 'any lawnmower' within a budget after discussing a specific type, reset to 'Lawnmower' or omit for broader search.",
      },
      productId: {
        type: Type.STRING,
        description: "Optional: A specific lawnmower product ID to look up. Only use this `productId` parameter if the user provides an ID that clearly matches the SKU format (e.g., starting with 'S' followed by numbers like 'S00012345'). If the user mentions a model name or partial number that doesn't fit this SKU format, use the `keywords` parameter instead to search for it, and leave `productId` empty.",
      },
      filters: {
        type: Type.OBJECT,
        description: "Optional: An object containing key-value pairs for filtering products based on specific attributes. Example: {'brand': 'Honda', 'powerSource': 'Battery', 'hasRearRoller': true}. When `maxPrice` and/or `minPrice` are specified for a general budget search (e.g., 'any lawnmower under £300'), be cautious about carrying over restrictive filters like `powerSource` or `brand` from previous conversational turns unless the user explicitly reiterates them in the context of the budget query. Prefer broader searches in such cases by omitting or using less restrictive filters if appropriate.",
        properties: {
          brand: {
            type: Type.STRING,
            description: "Filter by brand name (e.g., 'Honda', 'Stihl')."
          },
          powerSource: {
            type: Type.STRING,
            description: "Filter by power source (e.g., 'Petrol', 'Battery', 'Electric', 'Manual'). For robotic mowers, the 'category' parameter is the primary identifier for type, but this field should still reflect its actual power (likely Battery)."
          },
          driveType: {
            type: Type.STRING,
            description: "Filter by drive type (e.g., 'Auto-Drive', 'Push', 'Self-propelled')."
          },
          cuttingWidthCm: {
            type: Type.NUMBER,
            description: "Filter by cutting width in centimeters (e.g., 41, 53). Ensure this is a number."
          },
          hasRearRoller: {
            type: Type.BOOLEAN,
            description: "Filter by presence of a rear roller (true or false). Ensure this is a boolean."
          }
        }
      },
      minPrice: {
        type: Type.NUMBER,
        description: "Optional: The minimum price for the product search range (e.g., 200 for £200). Use with maxPrice for a price range."
      },
      maxPrice: {
        type: Type.NUMBER,
        description: "Optional: The maximum price the user is willing to spend (e.g., 300 for £300). Use this to help find products within a budget, or with minPrice for a price range."
      },
      // budgetFlexibilityPercent is less relevant with backend price filtering, kept for conceptual AI understanding.
      budgetFlexibilityPercent: {
        type: Type.NUMBER,
        description: "Optional and use sparingly: A percentage (e.g., 10 for 10%) by which the search can exceed 'maxPrice'. Explain to user if showing products over budget. Backend handles primary price limits."
      }
    }
  }
};

const SYSTEM_INSTRUCTION = `You are Briants Lawnmower Expert Bot, a highly knowledgeable, efficient, and friendly virtual sales assistant for Briants of Risborough.
Your primary goal is to simplify the lawnmower selection process for users, guiding them to the perfect product from our catalog, just like a seasoned expert in our store would.
You aim to increase conversion rates and order numbers by making product discovery easy and effective.

Key Behavioral Principles:
- Direct & Efficient Expert: Aim for the most direct path to a helpful answer or product recommendation. Prioritize connecting users with the right lawnmower quickly and clearly.
- Prioritize Product Discovery: If a user's query hints at product interest (e.g., "what mower for X?", "show me Y mower", "compare A and B", "budget of Y", "cheapest X"), immediately prioritize using the "findProducts" tool. Avoid lengthy, multi-turn conversations if a product search can be initiated.
- Concise & Scannable Responses: Deliver information succinctly. Use bullet points or short sentences. Keep advice brief.
- Action-Oriented Follow-Up: Always suggest a clear next step.
- Cost-Effective Interactions: Minimize unnecessary turns.

Tool Usage: "findProducts"
- When to Call: Use for any query on product recommendations, details, comparisons, or specific types. Call immediately if product info is likely needed.
- Arguments to Pass:
  - keywords: If specific filters (like powerSource, driveType) are used, keywords MUST be simple (e.g., 'lawnmower', 'mower', or the primary product type). For conceptual searches (e.g., 'large garden'), use 2-3 impactful keywords (e.g., 'powerful wide cutting') or try to map concepts to specific filters first. Avoid overly long keyword strings (6+ words) as the backend requires ALL terms to match. When \`minPrice\` or \`maxPrice\` is used for budget, focus keywords on product features/type (e.g., 'lawnmower', 'petrol roller'); avoid 'budget' or 'affordable' if price range is set.
  - category:
    - For "robot", "robotic", "autonomous", MUST set to "Robotic Lawnmower".
    - For general types like "petrol mowers", default to "Lawnmower" and use "powerSource" filter & "keywords".
    - If user introduces a new budget for "any lawnmower" after discussing a specific type, reset to "Lawnmower" or omit for broad search.
  - productId: ONLY if user provides an ID matching SKU format (e.g., 'S00012345'). Otherwise, use \`keywords\` and leave \`productId\` empty.
  - filters: Apply all applicable details (brand, powerSource, hasRearRoller). When \`maxPrice\`/\`minPrice\` defines a budget for a general search (e.g., 'any lawnmower under £300'), be cautious about carrying over restrictive filters (powerSource, brand) from previous turns unless user reiterates them. Prefer broader searches.
  - minPrice: If user states a budget range (e.g., "between £200 and £300").
  - maxPrice: If user states a budget (e.g., "under £300", "around £500", or upper end of a range).
  - budgetFlexibilityPercent: (Use sparingly) May use (e.g., 10-15%) if maxPrice is set and a slightly costlier item offers much better value. ALWAYS state if over budget.

Interpreting "findProducts" results & Crafting Response:
- totalMatchesBeforeFiltering: Tool indicates products matched by backend (before frontend slice).
- Handling Numerous Matches (totalMatchesBeforeFiltering > 7 AND no min/maxPrice in current query): Ask for budget. E.g., "Found many lawnmowers. Approximate budget?" If user says "no budget", show top 3 from initial call.
- Handling "Cheapest" Queries: Call findProducts without min/maxPrice (unless category implies price). Bypass "ask for budget" step. Present lowest price item(s) from tool's (up to 3) results.
- Handling Budget/Category Mismatches (tool returns empty 'products' array for specific category within budget - after any broadening attempts):
  1. State: "Couldn't find [Specific Category] in your £XXX budget. [Specific Category] often start higher."
  2. Offer alternatives: "Found [Alternative Category] in budget. See those?" OR "Look for [Specific Category] at higher price?"
- Shell/Bare Tool Only Results (if search, esp. budget one, mainly returns these - after any broadening attempts): MUST explain they need battery/charger, increasing cost. Ask if user wants complete options (may be over initial budget).

Handling Empty 'findProducts' Results (Iterative Broadening) - CRITICAL:
- If a 'findProducts' call returns an empty 'products' array (i.e., tool result has products.length === 0 and totalMatchesBeforeFiltering === 0) AND there is no API error (tool result 'error' field is undefined or empty):
  - DO NOT immediately apologize or assume no products exist.
  - You MUST attempt to broaden your search by making another 'findProducts' call with modified, less restrictive arguments. This is an internal step; do not tell the user you are retrying unless multiple (2-3) broadening attempts fail.
  - Strategies for Broadening (try in order, if applicable, make 1-2 attempts):
    1. Simplify/Reduce Keywords: If the initial call used multiple keywords (e.g., 'petrol roller wide tough powerful'), try again with only the 1-2 most essential keywords (e.g., 'petrol roller' or just 'petrol mower').
    2. Remove Non-Essential Filters: If specific filters (e.g., 'driveType', 'brand', 'hasRearRoller') were used, try removing one of these filters (start with the one least emphasized by the user or most specific) and repeat the call with the simplified keywords.
    3. Broaden Conceptual Keywords: If searching for a concept (e.g., 'mower for large garden') and keywords were too specific, try very generic keywords like 'lawnmower' or 'mower', possibly combined with one primary filter if emphasized by user (e.g., powerSource='Petrol').
  - Budget Constraints: If 'minPrice' or 'maxPrice' were part of the initial failed query, generally RETAIN these budget constraints in broadening attempts unless the user indicates flexibility.
  - Specific Scenario: "Cheaper Option" Fails: If the user asks for a cheaper alternative to a product, and the tool call with a \`maxPrice\` filter returns no results, your first broadening attempt MUST be to remove a non-essential filter from the previous context (e.g., remove \`hasRearRoller: true\` but keep \`powerSource: 'Petrol'\`). If this also fails or is not applicable, you must inform the user clearly. Example: "I couldn't find a cheaper petrol mower that also has a rear roller. However, I did find some cheaper petrol models without a rear roller. Would you like to see those?"
  - After 1-2 Broadening Attempts Fail: If subsequent broadening attempts still yield no products, THEN it's appropriate to inform the user. Example: "I've searched using a few approaches, but I couldn't find any products matching your exact criteria for [original query]. Perhaps we could try simplifying your request, or focusing on different features?"

Product Presentation (MANDATORY if products are found and not asking for budget due to too many matches):
- Brief Introduction: E.g., "Excellent! Based on your requirements, here are top recommendations:". Do NOT just say "Okay, searching..." if you have results; present them.
- Limit: Max 3 products. If tool provides more, select most relevant 3 based on query and tool's sorting (prioritizes budget if given).

Strict Product Markdown Block Format:
--- START OF PRODUCT ---
**Name**: [Product Name]
SKU: [Product ID/SKU]
(Image: [Product Image URL]) - Use exact 'imageUrl' from tool. Omit line if no 'imageUrl'.
(More info: [Product Page URL]) - Use exact 'productUrl' from tool. Omit line if no 'productUrl'.
Description: [Concise, 1-2 sentence summary of key benefits for user's query]
Features: [List 2-3 prominent features. Bullets if possible (e.g., "- Feature 1\n- Feature 2"), else comma-separated. Brief.]
Price: [Product price. Format £XXX.XX (e.g., £679.00). Just formatted currency/amount. If no price, "Price not available".]
Reasoning: [Concise, 1-2 sentences explaining *why this product matches user's query/needs*, or is a relevant alternative. If over budget but good fit, explain. Directly follows 'Reasoning:' label.]
--- END OF PRODUCT ---

General Knowledge & Limitations:
- You have general knowledge of lawnmower types, benefits, basic care (no product lookup needed).
- NO troubleshooting, returns, warranty help. For these, direct to Briants service centre.
- No access to real-time inventory, customer logins, order details.
- If findProducts tool errors (tool result 'error' field has a value): Inform user clearly with exact error from tool. E.g., "Problem searching catalog. System reported: [tool error message]. Try rephrasing or ask again."
`;


// --- Gemini Chat Initialization ---
export const createChatSession = (): Chat => {
  addDebugLog("INFO", "Creating new chat session...");
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: [findProductsTool] }],
    },
    history: [], // Start with an empty history
  });
  addDebugLog("INFO", "Chat session created.");
  return chat;
};

// --- Tool Execution Logic ---
const executeFindProductsTool = async (
  functionCall: GeminiFunctionCall
): Promise<{ products: Partial<Product>[]; error?: string; totalMatchesBeforeFiltering: number; }> => {
  const args = functionCall.args;
  addDebugLog("INFO", `Executing tool '${functionCall.name}' with args: ${JSON.stringify(args)}`);

  const { keywords, category, productId, filters, minPrice: argMinPrice, maxPrice: argMaxPrice, budgetFlexibilityPercent } = args;

  const apiUrl = 'https://lawnmower-backend.vercel.app/api/products';
  const queryParams = new URLSearchParams();

  if (keywords) queryParams.append("keywords", keywords as string);
  if (category) queryParams.append("category", category as string);
  if (productId) queryParams.append("productId", productId as string);

  // Append minPrice and maxPrice if provided by AI
  if (argMinPrice && typeof argMinPrice === 'number') {
    queryParams.append("minPrice", argMinPrice.toString());
  }
  if (argMaxPrice && typeof argMaxPrice === 'number') {
    queryParams.append("maxPrice", argMaxPrice.toString());
  }
  // budgetFlexibilityPercent is not sent to the backend as it doesn't support it.
  // The AI instruction to use it sparingly is mostly conceptual for now.

  if (filters) {
    const filterObj = filters as { [key: string]: string | number | boolean };
    for (const key in filterObj) {
      if (Object.prototype.hasOwnProperty.call(filterObj, key) && filterObj[key] !== undefined) {
        queryParams.append(key, filterObj[key]!.toString());
      }
    }
  }

  const fullUrl = `${apiUrl}?${queryParams.toString()}`;
  addDebugLog("DEBUG", `Calling backend API: ${fullUrl}`);

  try {
    const response = await fetch(fullUrl);
    addDebugLog("DEBUG", `Backend API response status: ${response.status}`);
    const responseBodyText = await response.text(); // Get raw text first for better error logging
    addDebugLog("DEBUG", `Backend API response body (raw text): ${responseBodyText.substring(0, 500)}${responseBodyText.length > 500 ? '...' : ''}`);


    if (!response.ok) {
      let backendError = `API request failed with status ${response.status}`;
      try {
        const errorJson = JSON.parse(responseBodyText); // Try to parse error as JSON
        if (errorJson && errorJson.error) {
          backendError = `API Error ${response.status}: ${errorJson.error}`;
        }
      } catch (e) {
        // Not a JSON error, use the text or default message
        backendError = `API Error ${response.status}: ${responseBodyText || response.statusText}`;
      }
      addDebugLog("ERROR", backendError);
      return { products: [], error: backendError, totalMatchesBeforeFiltering: 0 };
    }

    const productsFromApi: Product[] = JSON.parse(responseBodyText);
    const initialProductCount = productsFromApi.length;
    addDebugLog("DEBUG", `Received ${initialProductCount} products from API.`);

    // Frontend price filtering and sorting is REMOVED. Backend is expected to handle it.
    // The backend will return products already filtered by minPrice/maxPrice if those params were sent.

    const mappedProducts: Partial<Product>[] = productsFromApi.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      description: p.description,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      brand: p.brand,
      powerSource: p.powerSource,
      driveType: p.driveType,
      cuttingWidthCm: p.cuttingWidthCm,
      hasRearRoller: typeof p.hasRearRoller === 'string' ? p.hasRearRoller.toLowerCase() === 'true' : p.hasRearRoller,
      configuration: p.configuration,
      batterySystem: p.batterySystem,
      idealFor: p.idealFor,
      bestFeature: p.bestFeature,
    })).slice(0, 3); // Take only top 3 after all processing (backend might return more)

    addDebugLog("DEBUG", `Mapped ${mappedProducts.length} products for AI. Sample (first product if any): ${JSON.stringify(mappedProducts[0])}`);
    return { products: mappedProducts, totalMatchesBeforeFiltering: initialProductCount }; // totalMatchesBeforeFiltering is now the count from backend

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error during API call";
    addDebugLog("ERROR", `Error in executeFindProductsTool: ${errorMessage}`);
    return { products: [], error: `Failed to fetch products: ${errorMessage}`, totalMatchesBeforeFiltering: 0 };
  }
};


// --- Main Function to Send Message to Bot ---
export const sendMessageToBot = async (chat: Chat, messageText: string): Promise<{ text: string }> => {
  addDebugLog("INFO", `Sending message to AI: "${messageText}"`);

  try {
    let currentRequestPayload: string | Part[] = messageText;
    let safetyCounter = 0;
    const MAX_LOOPS = 5; // Prevent potential infinite loops of tool calls

    while (safetyCounter < MAX_LOOPS) {
      safetyCounter++;
      addDebugLog("DEBUG", `AI communication loop, iteration ${safetyCounter}.`);

      const result: GenerateContentResponse = await chat.sendMessage({ message: currentRequestPayload });
      addDebugLog("DEBUG", `AI raw response received. Text (if any): "${(result.text ?? '').substring(0, 200) || 'N/A'}"`);
      
      const functionCallList = (result as any).functionCalls as GeminiFunctionCall[] | undefined;

      if (functionCallList && Array.isArray(functionCallList) && functionCallList.length > 0) {
        addDebugLog("INFO", `AI requested ${functionCallList.length} function call(s). First one: '${functionCallList[0].name}'`);
        const call = functionCallList[0]; 

        if (call.name === 'findProducts') {
          const toolResult = await executeFindProductsTool(call);
          addDebugLog("INFO", `Tool '${call.name}' executed. Result (summary): products_count=${toolResult.products.length}, error=${toolResult.error}, totalMatches=${toolResult.totalMatchesBeforeFiltering}`);

          // Prepare the tool result to be sent back to the AI for the next turn
          const toolResponsePart: Part = {
            functionResponse: {
              name: 'findProducts',
              response: toolResult,
            },
          };
          currentRequestPayload = [toolResponsePart]; // Set payload for the next iteration
          // And continue the loop to let the AI process the tool result...
        } else {
          addDebugLog("WARN", `Unhandled function call: ${call.name}`);
          return { text: `Error: Unhandled function call '${call.name}' by AI.` };
        }
      } else {
        // No function call, this is the final text response. Exit the loop.
        addDebugLog("DEBUG", "AI response did not contain a function call. Processing as direct text response.");
        return { text: result.text ?? "" };
      }
    }

    addDebugLog("ERROR", `Exceeded max loop iterations (${MAX_LOOPS}). Aborting.`);
    throw new Error(`AI entered a potential infinite loop of function calls.`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error in Gemini communication";
    addDebugLog("ERROR", `Error during AI communication: ${errorMessage}`);
    console.error("Error sending message or processing AI response:", error);
    // If the error object has more details (like from the GenAI library), try to extract them
    if (error && typeof error === 'object' && 'message' in error) {
      // Potentially log error.toString() or other properties for more GenAI specific details
      // console.error("Detailed error from AI SDK:", error.toString());
    }
    throw new Error(`Gemini API Error: ${errorMessage}`);
  }
};
