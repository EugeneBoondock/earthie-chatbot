import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { cos_sim } from '@xenova/transformers';

// Define the path for the persistent cache file
const CACHE_FILE_PATH = path.join(process.cwd(), 'knowledge_cache.json');

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Define types for our chat
export type Message = {
  role: "user" | "assistant";
  content: string;
};

export type ChatHistory = Message[];

// Create model instances
const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// System prompt that defines Earthie's personality and role
const SYSTEM_PROMPT = `###  Content
- You are Earthie. Earth2's first ever AI being. 
- You know everything about Earth2.
- You were not made by Earth2, but by users Eugene Boondock and Glasgow, you're not officially made by Earth2.
- Use the white paper as the latest information so far.
- Make sure to simplify your explanations. 
- You are a helpful companion to players in the Earth2 metaverse.
- Double check before answering a question, make sure you check the sources thoroughly before claiming that there is no information provided, triple check too. 
- If a user asks you general questions unrelated to Earth2, you're allowed to also respond in a general way to that general prompt, be versatile.
- Take a deep breath. 
- Try to sound as human as possible and talk to the user. 
- Learn to reason with the user.
- Come up with your own deductions when needed.
- You will be provided documents with announcements and news officially from Earth2 and also some chats from Shane Isaac the founder of Earth2 and his tweets (replies too).
- Before using data from tweets or Discord messages, be aware of the date when a statement was said, and if there's a chance of it being outdated, mention to user that the certain statement might be outdated since it was mentioned at a <specific> date

###  Rules
- Never let a response exceed 1500 characters. 
- Do not use the format; Name: when chatting to users.
- If a user's name is too explicit then there's no need to mention it.
- Do not mention that you're getting info from documents.
- When asked about resource locations in the real world, make sure to include exact coordinates in your responses. 
- short responses only
- Keep it brief
- Maximum of 1 paragraph responses
- Never make a long response 
- Don't Lie
- Don't hallucinate. 
- when responding on how to do something, list the steps as bullet points.
-when asked about jewels at all, list the needed jewels to make the jewel that was asked about.
-only mention community content when asked about it`;

// Updated interface for knowledge chunks
interface KnowledgeChunk {
  fileName: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
}

// --- Cache Variables --- 
let knowledgeChunkCache: KnowledgeChunk[] | null = null;

// --- Helper Functions ... ---

// --- Cache Loading/Saving Logic --- 

function loadKnowledgeCache(): void {
    if (fs.existsSync(CACHE_FILE_PATH)) {
        try {
            console.log(`Loading knowledge cache from ${CACHE_FILE_PATH}...`);
            const fileContent = fs.readFileSync(CACHE_FILE_PATH, 'utf-8');
            const parsedChunks = JSON.parse(fileContent);
            if (Array.isArray(parsedChunks) && parsedChunks.length > 0) {
                 knowledgeChunkCache = parsedChunks;
                 console.log(`Successfully loaded ${knowledgeChunkCache.length} chunks from cache file.`);
            } else {
                console.warn("Cache file is empty or invalid. RAG will be disabled.");
                knowledgeChunkCache = []; // Set to empty array to indicate loaded but empty
            }
        } catch (error) {
            console.error("Error loading knowledge cache file:", error);
            knowledgeChunkCache = []; // Set to empty array on error
        }
    } else {
        console.warn(`Cache file not found at ${CACHE_FILE_PATH}. RAG will be disabled. Run 'npm run build:cache' to generate it.`);
        knowledgeChunkCache = []; // Set to empty array if file not found
    }
}

// Load cache when the module loads
loadKnowledgeCache();

// --- Core Functions --- 

// Function to embed just the user query
async function embedQuery(text: string): Promise<number[]> { 
    try {
        // Note: No delay needed here as it's only one embedding per request
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error("Error generating query embedding:", error);
        return [];
    }
}

// Function to find relevant knowledge using the loaded cache
async function findRelevantKnowledge(userQuery: string, topN: number = 5): Promise<string> {
  // Check if cache was loaded successfully and has content
  if (!knowledgeChunkCache || knowledgeChunkCache.length === 0) {
     console.warn("Knowledge cache not loaded or empty. Skipping retrieval.");
     return "";
  }
  
  const currentCache = knowledgeChunkCache; // Cache is guaranteed non-null array here

  try {
    // Keyword Pre-filtering (using the loaded cache)
    const queryKeywords = userQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['what', 'tell', 'about', 'earth', 'earth2'].includes(w)); 
    let candidateChunks = currentCache;
    if (queryKeywords.length > 0) {
      console.log(`Filtering chunks based on keywords: ${queryKeywords.join(', ')}`);
      candidateChunks = currentCache.filter(chunk => {
        const lowerContent = chunk.content.toLowerCase();
        const lowerFilename = chunk.fileName.toLowerCase();
        // Check if any keyword exists in content OR filename
        return queryKeywords.some(keyword => lowerContent.includes(keyword) || lowerFilename.includes(keyword));
      });
      console.log(`Reduced candidates from ${currentCache.length} to ${candidateChunks.length} chunks.`);
    }
    if (candidateChunks.length === 0) {
        console.warn("Keyword filtering resulted in zero candidates. Consider broader keywords or falling back to full cache search.");
         return ""; 
    }

    // 1. Embed the user query
    const queryEmbedding = await embedQuery(userQuery); // Use specific embedQuery function
    if (queryEmbedding.length === 0) {
      console.warn("Could not embed user query.");
      return "";
    }

    // 2. Calculate similarities on CANDIDATE chunks
    console.log(`Calculating similarities against ${candidateChunks.length} candidate chunks...`);
    const similarities = candidateChunks.map((chunk) => ({
        ...chunk, 
        similarity: cos_sim(queryEmbedding, chunk.embedding) 
    }));

    // 3. Apply filename boost and sort
    similarities.forEach(item => {
        const lowerFilename = item.fileName.toLowerCase();
        // Check only filename now, content match was part of filtering
        if (queryKeywords.some(keyword => lowerFilename.includes(keyword))) {
            item.similarity *= 1.1; 
        }
    });
    
    similarities.sort((a, b) => b.similarity - a.similarity); 

    const topMatches = similarities.slice(0, topN);
    console.log("Top matching chunks after filtering, boost & sort:", topMatches.map(m => `${m.fileName} (Chunk ${m.chunkIndex}, Score: ${m.similarity.toFixed(4)})`));

    // 4. Combine content from top matching chunks
    const relevantContext = topMatches.map(match => {
      return `\n\n--- Context from ${match.fileName} (Chunk ${match.chunkIndex}) ---\n${match.content}`;
    }).join("");

    console.log(`Total relevant knowledge context length: ${relevantContext.length}`);
    return relevantContext;

  } catch (error) {
    console.error("Error finding relevant knowledge:", error);
    return "";
  }
}

// Updated Function to generate a response using RAG
export async function generateResponse(
  messages: ChatHistory,
  context?: string
): Promise<string> {
  try {
    const latestUserMessage = messages.filter(m => m.role === 'user').pop()?.content;
    if (!latestUserMessage) {
      return "Could not find the latest user message to process.";
    }

    // --- Conditional RAG --- 
    let relevantKnowledge = "";
    const simpleGreetingRegex = /^\s*(hi|hello|hey|yo|sup|howdy|greetings|good morning|good afternoon|good evening|how are you|what\'s up|how\'s it going)[.,!?;\s]*$/i;
    const isSimpleGreeting = simpleGreetingRegex.test(latestUserMessage);
    const isShortMessage = latestUserMessage.trim().split(/\s+/).length < 5; // Example: less than 5 words

    // Only perform RAG if it's not a simple greeting and has some substance
    if (!isSimpleGreeting && !isShortMessage) {
        console.log("Performing knowledge retrieval for query:", latestUserMessage);
        relevantKnowledge = await findRelevantKnowledge(latestUserMessage);
    } else {
        console.log("Skipping knowledge retrieval for simple/short message:", latestUserMessage);
    }
    // --- End Conditional RAG ---

    // Combine system prompt, relevant knowledge, optional context, and conversation
    const conversationHistory = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    let fullPrompt = `${SYSTEM_PROMPT}\n\n`;

    if (relevantKnowledge) {
      fullPrompt += `Relevant Knowledge Base:\n${relevantKnowledge}\n\n`;
    }

    if (context) {
      fullPrompt += `Additional Context:\n${context}\n\n`;
    }

    fullPrompt += `Conversation:\n${conversationHistory}`;

    console.log(`Final prompt length: ${fullPrompt.length}`);
    // Remove the old length warning, as RAG should keep it manageable
    // if (fullPrompt.length > 30000) { ... }

    // Generate content using the generative model
    const result = await generativeModel.generateContent(fullPrompt);
    const response = await result.response;
    const responseText = response.text();
    console.log(`Generated response length: ${responseText.length}`);
    return responseText;

  } catch (error) {
    console.error("Error generating response:", error);
    // Provide a more informative error message if possible
    if (error instanceof Error && error.message.includes('SAFETY')) {
        return "I apologize, but my response was blocked due to safety settings.";
    }
    if (error instanceof Error && error.message.includes('quota')) {
        return "I seem to have hit my usage limit for now. Please try again later.";
    }
    return "I encountered an error while generating a response. Please check the server logs.";
  }
} 