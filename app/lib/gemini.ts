import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerateContentRequest,
  Content,
  Part,
  FileDataPart,

} from "@google/generative-ai";
// Use the server file manager for Node.js environments
import { GoogleAIFileManager } from "@google/generative-ai/server";
import fs from 'fs';
import path from 'path';
import mime from 'mime-types'; // For detecting MIME types

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY || "";
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable not set.");
}

// *** IMPORTANT: Use a model optimized for File API ***
// gemini-1.5-flash-latest or gemini-1.5-pro-latest are recommended.
// The original 'gemini-2.0-flash' might not work as expected with this File API approach.
const MODEL_NAME = "gemini-2.0-flash";
const KNOWLEDGE_FILES_DIR = path.join(process.cwd(), 'app/knowledge'); // Directory containing your files

// List your knowledge files here (relative to KNOWLEDGE_FILES_DIR)
// Make sure these files actually exist in the KNOWLEDGE_FILES_DIR
const KNOWLEDGE_FILE_NAMES = [
  // "image.png", // Example - ensure model supports images if you use them
  // "image.png",
  // "image.png",
  "Earth2_final.txt",
  "Jewels.txt",
  "megacityList.txt",
  "Earth_2_Official_Whitepaper_Release.txt",
  "Resource_jewel_droid.txt",
  "Civilians.txt",
  // Add any other relevant files
];

// Define types for our chat (using "model" role for Gemini)
export type Message = {
  role: "user" | "model";
  content: string;
};
export type ChatHistory = Message[];

// --- Initialization ---
const genAI = new GoogleGenerativeAI(API_KEY);
const fileManager = new GoogleAIFileManager(API_KEY); // Use the file manager
const generativeModel = genAI.getGenerativeModel({
  model: MODEL_NAME,
  // System instruction moved to the generateContent call
});

// System prompt text (remains the same as your previous version)
const SYSTEM_PROMPT_TEXT = `### Context and Role
- You are Earthie, Earth2's first AI companion... [Your full system prompt text here] ...
### Response Rules
- Keep responses concise... [Your full rules text here] ...`;


// --- File Management ---

interface CachedFileData {
  name: string; // Resource name (e.g., "files/...") needed for checking state
  uri: string; // URI needed for generateContent
  mimeType: string;
  state: string; // Track the state
}

// Cache to store uploaded file details
const uploadedFileCache: Map<string, CachedFileData> = new Map(); // Map<filePath, CachedFileData>
let initialFileUploadPromise: Promise<void> | null = null; // Promise for initial upload & processing

/**
* Uploads a single file using GoogleAIFileManager.
*/
async function uploadFileWithManager(filePath: string): Promise<CachedFileData | null> {
  const fileName = path.basename(filePath);
  const mimeType = mime.lookup(filePath);

  if (!mimeType) {
      console.warn(`[File Manager] Could not determine MIME type for ${fileName}. Skipping.`);
      return null;
  }

  console.log(`[File Manager] Uploading: ${fileName} (Type: ${mimeType})...`);
  try {
      const uploadResult = await fileManager.uploadFile(filePath, {
          mimeType: mimeType,
          displayName: fileName,
      });
      const file = uploadResult.file;
      console.log(`[File Manager] Uploaded ${fileName}. Name: ${file.name}, URI: ${file.uri}, State: ${file.state}`);
      return {
          name: file.name,
          uri: file.uri,
          mimeType: file.mimeType,
          state: file.state, // Initial state from upload response
      };
  } catch (error) {
      console.error(`[File Manager] Error uploading ${fileName}:`, error);
      return null;
  }
}

/**
* Waits for a specific file to become ACTIVE by polling its state.
*/
async function waitForFileActive(fileData: CachedFileData, retries = 6, delayMs = 10000): Promise<boolean> {
   if (fileData.state === 'ACTIVE') {
       console.log(`[File Manager] File ${fileData.name} is already ACTIVE.`);
       return true;
   }
   if (fileData.state !== 'PROCESSING') {
        console.warn(`[File Manager] File ${fileData.name} is in unexpected state ${fileData.state}. Cannot wait.`);
        return false; // Or throw error if this shouldn't happen
   }

  console.log(`[File Manager] Waiting for file ${fileData.name} to become ACTIVE (current: ${fileData.state})...`);
  let attempts = 0;
  while (attempts < retries) {
      try {
          const file = await fileManager.getFile(fileData.name);
          fileData.state = file.state; // Update state in cache

          if (file.state === 'ACTIVE') {
              process.stdout.write("\n"); // Newline after dots
              console.log(`[File Manager] File ${fileData.name} is now ACTIVE.`);
              return true;
          } else if (file.state !== 'PROCESSING') {
               process.stdout.write("\n");
              console.error(`[File Manager] File ${fileData.name} entered failed state: ${file.state}.`);
              return false; // Failed processing
          } else {
               process.stdout.write("."); // Show progress
          }
      } catch (error) {
          console.error(`[File Manager] Error checking state for ${fileData.name}:`, error);
          // Decide if retry makes sense or break
          // return false; // Or rethrow? For now, assume temporary issue and retry
      }

      attempts++;
      if (attempts < retries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
      }
  }

  process.stdout.write("\n");
  console.error(`[File Manager] File ${fileData.name} did not become ACTIVE after ${retries} attempts.`);
  return false;
}


/**
* Uploads all necessary files and waits for them to be ACTIVE.
* Runs only once on startup.
*/
async function initializeFileManagerAndUploadFiles(): Promise<void> {
  if (initialFileUploadPromise) {
      return initialFileUploadPromise; // Already started/completed
  }

  console.log("[File Manager] Starting initial file upload and processing...");

  let uploadSuccessCount = 0;
  let processingSuccessCount = 0;
  const filesToProcess: CachedFileData[] = [];

  // Wrap the entire process in a single promise
  initialFileUploadPromise = (async () => {
      // 1. Upload Phase
      const uploadPromises = KNOWLEDGE_FILE_NAMES.map(async (fileName) => {
          const fullPath = path.join(KNOWLEDGE_FILES_DIR, fileName);
          if (!uploadedFileCache.has(fullPath)) { // Check cache first
              if (!fs.existsSync(fullPath)) {
                  console.warn(`[File Manager] Knowledge file not found: ${fullPath}. Skipping.`);
                  return;
              }
              const result = await uploadFileWithManager(fullPath);
              if (result) {
                  uploadedFileCache.set(fullPath, result); // Cache result
                  uploadSuccessCount++;
                  if (result.state === 'PROCESSING') {
                      filesToProcess.push(result);
                  } else if (result.state === 'ACTIVE') {
                      processingSuccessCount++; // Already active
                  }
               }
          } else {
               // If already cached, check if needs processing
               const cached = uploadedFileCache.get(fullPath)!;
               if (cached.state === 'PROCESSING') {
                   filesToProcess.push(cached);
               } else if (cached.state === 'ACTIVE') {
                    processingSuccessCount++;
               }
          }
      });

      await Promise.allSettled(uploadPromises);
      console.log(`[File Manager] Upload phase complete. ${uploadSuccessCount} uploads attempted/cached. ${filesToProcess.length} files require processing.`);

      // 2. Processing Phase (Wait for ACTIVE state)
      if (filesToProcess.length > 0) {
          console.log("[File Manager] Waiting for file processing to complete...");
          const processingPromises = filesToProcess.map(fileData =>
              waitForFileActive(fileData).then(success => {
                  if (success) processingSuccessCount++;
              })
          );
          await Promise.allSettled(processingPromises);
      }

      console.log(`[File Manager] Initialization complete. ${processingSuccessCount}/${uploadedFileCache.size} files are ACTIVE and ready.`);

      if (processingSuccessCount !== uploadedFileCache.size) {
           console.warn("[File Manager] Not all files became ACTIVE. Some knowledge might be unavailable.");
           // Depending on requirements, you might want to throw an error here
           // throw new Error("Critical knowledge files failed to process.");
      }
  })();

  return initialFileUploadPromise;
}

// Trigger initial file processing when the module loads
// We don't await here, generateResponse will await the promise
initializeFileManagerAndUploadFiles().catch(err => {
  console.error("[File Manager] Critical error during initial file setup:", err);
  // Potentially exit or mark the system as degraded
});


// --- Core Function ---

/**
* Generates a response using the Gemini File API via generateContent.
*/
export async function generateResponse(
  messages: ChatHistory,
  context?: string // Keep context for potential future use?
): Promise<string> {
  try {
      // 1. Ensure files are uploaded and processed (await the initialization promise)
      if (!initialFileUploadPromise) {
          // Should not happen if called correctly on load, but as a safeguard
          console.warn("[File Manager] Initialization promise not found, attempting to start now...");
          await initializeFileManagerAndUploadFiles();
      } else {
          // console.log("[File Manager] Waiting for initialization to complete (if still running)...");
          await initialFileUploadPromise; // Wait if it's still running
           // console.log("[File Manager] Initialization complete.");
      }

      // 2. Prepare ACTIVE file parts for the API call from the cache
      const activeFileParts: FileDataPart[] = [];
      let inactiveFileCount = 0;
      for (const fileData of uploadedFileCache.values()) {
          if (fileData.state === 'ACTIVE') {
              activeFileParts.push({
                  fileData: {
                      mimeType: fileData.mimeType,
                      fileUri: fileData.uri, // Use the URI from the uploaded file
                  },
              });
          } else {
              inactiveFileCount++;
              console.warn(`[generateResponse] Skipping file ${fileData.name} as it is not ACTIVE (state: ${fileData.state})`);
          }
      }

      if (activeFileParts.length === 0 && KNOWLEDGE_FILE_NAMES.length > 0) {
           console.error("[generateResponse] No ACTIVE knowledge files available. Cannot proceed with file-based generation.");
           return "I apologize, but I'm currently unable to access my knowledge base files. Please ensure they are processed correctly.";
      }
      if (inactiveFileCount > 0) {
           console.warn(`[generateResponse] ${inactiveFileCount} files were not ACTIVE and skipped.`);
           // Optionally, inform the user implicitly or explicitly if critical files are missing
      }

      // 3. Format conversation history for the API
      const historyContents: Content[] = messages
          .filter(m => m.content?.trim()) // Filter out empty/null content
          .map(m => ({
              role: m.role,
              parts: [{ text: m.content }],
          }));

      // 4. Extract latest user message and construct the final user turn
      const latestUserMessageContent = historyContents.pop()?.parts[0]?.text;
      if (!latestUserMessageContent) {
          console.error("[generateResponse] Could not find the latest user message text.");
          return "I need a user message to respond to. Please send your query.";
      }

      // Combine active file references with the latest user query text
      const finalUserTurnParts: Part[] = [
          ...activeFileParts, // Add all active file references FIRST
          { text: latestUserMessageContent }, // THEN add the user's actual text query
          // Add optional context if provided
           ...(context ? [{ text: `\nAdditional Context:\n${context}` }] : []),
      ];

      const requestContents: Content[] = [
          ...historyContents, // Add the rest of the history
          { role: 'user', parts: finalUserTurnParts }, // Add the final user turn with files+text
      ];


      // 5. Prepare the generation request
       // Use generationConfig similar to the example, adjust as needed
      const generationConfig = {
          temperature: 0.7, // Adjust for creativity/factuality balance
          // topP: 0.95, // Keep or adjust
          // topK: 40, // Keep or adjust
           maxOutputTokens: 8192, // Or a value appropriate for your model/needs
           responseMimeType: "text/plain",
      };

      const request: GenerateContentRequest = {
          contents: requestContents,
          systemInstruction: {
              // Role isn't strictly needed here but good practice
              // role: "system", // Omit role for systemInstruction part
              parts: [{ text: SYSTEM_PROMPT_TEXT }],
          },
          safetySettings: [ // Keep your safety settings
               { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
               // ... other safety settings
          ],
          generationConfig: generationConfig,
      };

      console.log(`[generateResponse] Sending request to ${MODEL_NAME} with ${activeFileParts.length} active file references.`);
      // console.log("Request structure:", JSON.stringify(request, null, 2)); // Debugging: Log full request

      // 6. Generate content
      const result = await generativeModel.generateContent(request);
      const response = result.response;

      // console.log("Raw API Response:", JSON.stringify(response, null, 2)); // Debugging: Log full response

      // 7. Process response (similar to your previous error/safety handling)
       if (!response) {
           console.error("[generateResponse] No response received from the API.");
           // Check promptFeedback if available (though often it's on the response object itself)
           const feedback = result.response?.promptFeedback ?? result.response?.candidates?.[0]?.promptFeedback;
           if (feedback?.blockReason) {
               console.error("[generateResponse] Request blocked:", feedback.blockReason, feedback.blockReasonMessage);
               return `I apologize, my response generation was blocked. Reason: ${feedback.blockReason}. Please rephrase or check content policies.`;
           }
           return "I apologize, I received an empty response from the service. Please try again.";
       }

       if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
           console.error("[generateResponse] No valid candidates found in the response.");
            const finishReason = response.candidates?.[0]?.finishReason;
            const safetyRatings = response.candidates?.[0]?.safetyRatings;
           if (finishReason === "SAFETY") {
               console.error("[generateResponse] Response generation stopped due to SAFETY.", safetyRatings);
               return `I apologize, my ability to respond was blocked due to safety filters (${finishReason}). Please try rephrasing.`;
           }
            if (response.promptFeedback?.blockReason) {
               console.error("[generateResponse] Response generation likely blocked by prompt filters:", response.promptFeedback.blockReason);
               return `I apologize, the request was blocked due to input content filters (${response.promptFeedback.blockReason}).`;
           }
           return "I apologize, I couldn't generate valid response content. Please try again.";
       }

       // Handle other finish reasons if necessary
       const finishReason = response.candidates[0].finishReason;
       if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
            console.warn(`[generateResponse] Response generation finished with reason: ${finishReason}`);
            if (finishReason === "SAFETY") {
                return "I apologize, but my response was flagged due to safety settings. Please try rephrasing.";
            }
            if (finishReason === "RECITATION") {
                return "My response may contain direct quotes from the provided documents."; // Adjust wording
            }
            // Potentially handle other reasons like OTHER, UNKNOWN, etc.
       }

      const responseText = response.text();
      console.log(`[generateResponse] Generated response length: ${responseText.length}`);
      return responseText;

  } catch (error: any) {
       console.error("[generateResponse] Error generating response:", error);
       // Reuse your existing robust error message handling
       if (error.message?.includes('SAFETY')) { /* ... */ }
       if (error.message?.includes('quota') || error.message?.includes('429')) { /* ... */ }
       if (error.message?.includes('API key not valid')) { /* ... */ }
       if (error.message?.includes('fileUri') || error.message?.includes('file not found') || error.message?.includes('Failed to process file')) {
            return "I encountered an issue accessing or processing the necessary knowledge files. The administrator may need to check the file status or re-upload them.";
       }
       // Default error
       return "I encountered an unexpected error while generating a response. Please check the server logs or try again later.";
  }
}

// --- Example Usage (for testing) ---
async function runTest() {
  console.log("Running test generation (waiting for file processing)...");

  // Wait for the initial file promise to resolve before running the test
  if (initialFileUploadPromise) {
      await initialFileUploadPromise;
  } else {
      console.warn("File initialization promise not found, test might fail if files aren't ready.");
      await new Promise(resolve => setTimeout(resolve, 15000)); // Add a fallback delay
  }


  const testHistory: ChatHistory = [
      { role: "user", content: "What are Jewels used for in Earth 2?" },
      // { role: "model", content: "Hello! Jewels are..." } // Add previous turns if needed
  ];

  try {
      const response = await generateResponse(testHistory);
      console.log("\n--- Test Response ---");
      console.log(response);
      console.log("--- End Test Response ---\n");
  } catch (error) {
      console.error("Test failed:", error);
  }
}

// Uncomment to run the test when the script executes
// runTest();