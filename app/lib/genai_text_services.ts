import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
    // We might not need all types from the main gemini.ts if these are simple calls
} from "@google/generative-ai";

// --- Configuration ---
const API_KEY = process.env.GEMINI_API_KEY || "";
if (!API_KEY) {
  // For a library file, throwing an error immediately might be too aggressive
  // Consider logging and letting the calling function handle it,
  // or ensure API_KEY is checked robustly where these functions are called.
  console.error("GEMINI_API_KEY environment variable not set. Text services may fail.");
}

const MODEL_NAME_TEXT_SERVICES = "gemini-2.0-flash-lite"; // As requested

// --- Initialization ---
// Initialize a specific GenAI instance for these text services
// This avoids interfering with any specific setup in the main app/lib/gemini.ts
const genAITextServices = new GoogleGenerativeAI(API_KEY);

// --- Translation Function ---
/**
 * Translates text to a target language using the specified Gemini model.
 */
export async function translateText(
    textToTranslate: string,
    targetLanguage: string,
    sourceLanguage: string = "auto" // Gemini can often auto-detect source
): Promise<string> {
    if (!textToTranslate?.trim()) {
        throw new Error("Text to translate cannot be empty.");
    }
    if (!targetLanguage?.trim()) {
        throw new Error("Target language cannot be empty.");
    }
    if (!API_KEY) { // Check API key before making a call
        throw new Error("Gemini API Key is not configured for translation service.");
    }

    const translateModel = genAITextServices.getGenerativeModel({ model: MODEL_NAME_TEXT_SERVICES });

    const prompt = `Translate the following text from ${sourceLanguage === "auto" ? "the auto-detected language" : sourceLanguage} to ${targetLanguage}:\\n\\n"${textToTranslate}"\\n\\nTranslated text:`;

    console.log(`[translateTextService] Prompting ${MODEL_NAME_TEXT_SERVICES} for translation to ${targetLanguage}.`);

    try {
        const result = await translateModel.generateContent(prompt);
        const response = result.response;

        if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
            console.error("[translateTextService] No valid candidates found in the translation response.", response?.promptFeedback);
            const finishReason = response?.candidates?.[0]?.finishReason;
            if (finishReason === "SAFETY") {
                 return `Translation blocked due to safety filters.`;
            }
            if (response?.promptFeedback?.blockReason) {
                return `Translation request blocked due to input content filters (${response.promptFeedback.blockReason}).`;
            }
            throw new Error("Failed to get a valid translation from the API.");
        }
        const translated = response.text();
        // console.log(`[translateTextService] Received translation: ${translated.substring(0, 100)}...`);
        return translated;
    } catch (error: any) {
        console.error(`[translateTextService] Error translating text with ${MODEL_NAME_TEXT_SERVICES}:`, error);
        throw new Error(`Translation failed: ${error.message}`);
    }
}

// --- Summarization Function ---
/**
 * Summarizes text using the specified Gemini model.
 */
export async function summarizeText(
    textToSummarize: string
): Promise<string> {
    if (!textToSummarize?.trim()) {
        throw new Error("Text to summarize cannot be empty.");
    }
     if (!API_KEY) { // Check API key before making a call
        throw new Error("Gemini API Key is not configured for summarization service.");
    }

    const summarizeModel = genAITextServices.getGenerativeModel({ model: MODEL_NAME_TEXT_SERVICES });

    const prompt = `Please provide a concise summary of the following text:\\n\\n"${textToSummarize}"\\n\\nSummary:`;

    console.log(`[summarizeTextService] Prompting ${MODEL_NAME_TEXT_SERVICES} for summarization.`);

    try {
        const result = await summarizeModel.generateContent(prompt);
        const response = result.response;

        if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
            console.error("[summarizeTextService] No valid candidates found in the summarization response.", response?.promptFeedback);
            const finishReason = response?.candidates?.[0]?.finishReason;
            if (finishReason === "SAFETY") {
                 return `Summarization blocked due to safety filters.`;
            }
            if (response?.promptFeedback?.blockReason) {
                return `Summarization request blocked due to input content filters (${response.promptFeedback.blockReason}).`;
            }
            throw new Error("Failed to get a valid summary from the API.");
        }
        const summary = response.text();
        // console.log(`[summarizeTextService] Received summary: ${summary.substring(0, 100)}...`);
        return summary;
    } catch (error: any) {
        console.error(`[summarizeTextService] Error summarizing text with ${MODEL_NAME_TEXT_SERVICES}:`, error);
        throw new Error(`Summarization failed: ${error.message}`);
    }
} 