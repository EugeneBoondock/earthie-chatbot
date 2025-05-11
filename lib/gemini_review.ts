import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ReviewResult {
  approved: boolean;
  comment: string;
  badge: string;
  requiresHuman: boolean;
}

export async function reviewCode(code: string): Promise<ReviewResult> {
  // Use Gemini API key from .env.local
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set. Define it in .env.local');
  }

  // Initialize the Google GenAI SDK
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

  // Get the byte size of the code when encoded as UTF-8
  const encoder = new TextEncoder();
  const codeBytes = encoder.encode(code);
  const codeSizeKB = codeBytes.length / 1024;
  
  // If code is too large, truncate it to fit within API limits
  const maxCodeSizeKB = 16;
  let codeToReview = code;
  let truncated = false;
  
  if (codeSizeKB > maxCodeSizeKB) {
    truncated = true;
    // Truncate the code while respecting UTF-8 encoding
    const truncatedLength = Math.floor(maxCodeSizeKB * 1024);
    const truncatedBytes = codeBytes.slice(0, truncatedLength);
    codeToReview = new TextDecoder().decode(truncatedBytes);
    
    console.log(`Code size (${codeSizeKB.toFixed(2)}KB) exceeds limit, truncating...`);
    console.log(`Truncated code size: ${(truncatedBytes.length / 1024).toFixed(2)}KB`);
  }

  // Create a structured prompt for the code review
  const prompt = `[System: You are an expert code reviewer for ${truncated ? 'a partial' : 'the'} script provided below. Your task is to evaluate the code quality, security, and adherence to best practices. ${truncated ? 'Note that this is only part of the full code due to size limitations.' : ''} 
  Provide a thorough review focusing on:
  1. Code quality and readability
  2. Potential security risks
  3. Error handling
  4. Performance considerations
  5. Best practice adherence
  
  After your review, provide a final assessment with:
  - A clear APPROVE or REJECT recommendation
  - A brief summary comment explaining your decision
  - A badge label that best describes the code (e.g., "Secure", "Needs Review", "Potentially Unsafe")
  - Whether human review is recommended

  Format your response strictly as follows:
  RECOMMENDATION: [APPROVE or REJECT]
  COMMENT: [Brief explanation]
  BADGE: [Badge label]
  HUMAN_REVIEW: [YES or NO]
  
  Here is the code to review:
  \`\`\`
  ${codeToReview}
  \`\`\`
  ]`;

  try {
    // Create a controller to handle timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    // Send the code review request to the API
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024
      }
    });
    
    clearTimeout(timeoutId);
    
    // Get the response text
    const responseText = result.response.text();
    
    // Parse the response to extract the review information using basic regex patterns
    const recommendationMatch = /RECOMMENDATION:\s*(APPROVE|REJECT)/i.exec(responseText);
    const recommendation = recommendationMatch ? recommendationMatch[1].toUpperCase() : 'REJECT';
    
    const commentMatch = /COMMENT:\s*(.+?)(\n|BADGE:|$)/i.exec(responseText);
    const comment = commentMatch ? commentMatch[1].trim() : 'No comment provided';
    
    const badgeMatch = /BADGE:\s*(.+?)(\n|HUMAN_REVIEW:|$)/i.exec(responseText);
    const badge = badgeMatch ? badgeMatch[1].trim() : 'Needs Review';
    
    const humanReviewMatch = /HUMAN_REVIEW:\s*(YES|NO)/i.exec(responseText);
    const humanReview = humanReviewMatch ? humanReviewMatch[1].toUpperCase() === 'YES' : true;

    return {
      approved: recommendation === 'APPROVE',
      comment,
      badge,
      requiresHuman: humanReview
    };
  } catch (error: unknown) {
    console.error('Error calling Gemini API:', error);
    throw new Error(`Review API error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
