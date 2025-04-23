# Earthie Chatbot: Gemini Integration

This project integrates Google Gemini models into a Node.js/Next.js application to provide advanced AI chat capabilities for the Earth2 metaverse community.

## Features
- Uses Google Gemini models (supports 1.5 and 2.5 preview models)
- Loads knowledge files from the `app/knowledge` directory
- Provides a `generateResponse` function for chat-based AI responses
- Customizable system prompt for Earth2 context

## Setup

### 1. Install Dependencies
```
npm install
```

### 2. Set Environment Variables
Create a `.env` file in the project root with your Gemini API key:
```
GEMINI_API_KEY=your_google_gemini_api_key_here
```

### 3. Knowledge Files
Place your knowledge files (e.g., `.txt` files) in the `app/knowledge` directory. Update the `KNOWLEDGE_FILE_NAMES` array in `app/lib/gemini.ts` to include your files.

### 4. Model Selection
By default, the code uses the preview model:
```
const MODEL_NAME = "models/gemini-2.5-flash-preview-04-17";
```
If you encounter errors, try switching to a stable model:
```
const MODEL_NAME = "models/gemini-1.5-flash";
```

### 5. Usage
Import and use the `generateResponse` function in your server-side code:
```ts
import { generateResponse } from './app/lib/gemini';

const response = await generateResponse([
  { role: 'user', content: 'What are Jewels used for in Earth 2?' }
]);
console.log(response);
```

**Note:**
- The Gemini API must be called from the server (Node.js), not from the browser.
- Ensure your API key has access to the selected model.

## Troubleshooting
- If you see errors like `Failed to process response` or empty error objects, try:
  - Updating the SDK: `npm install @google/generative-ai@latest`
  - Using a stable model name
  - Ensuring your API key is valid and has model access
  - Making the API call server-side only
- For more details, check the console logs for error output.

## License
MIT 