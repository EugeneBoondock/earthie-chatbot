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

  // Send request to Gemini via Google Vertex AI
  const endpoint = `https://generativelanguage.googleapis.com/v1beta2/models/gemini-2.0-flash-lite:generateMessage?key=${apiKey}`;
  const prompt = {
    text: `You are a security-focused code reviewer. Analyze the provided code for any malicious patterns or usage of external URLs. Respond with a JSON object: { "approved": boolean, "comment": string, "requiresHuman": boolean, "badge": "Reviewed by Gemini 2.0 Flash-Lite" }. CODE: ${code}`
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`Review API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Response from Vertex AI: data.candidates[0].content holds the text
  const content = data.candidates?.[0]?.content;
  try {
    const result = JSON.parse(content);
    return result;
  } catch (e) {
    console.error('Failed to parse review response:', content);
    return {
      approved: false,
      comment: 'Invalid review response',
      badge: 'Reviewed by Gemini 2.0 Flash-Lite',
      requiresHuman: true,
    };
  }
}
