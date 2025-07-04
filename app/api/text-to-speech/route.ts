import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Strip markdown formatting for better speech synthesis
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1')     // Remove italic markdown
      .replace(/`(.*?)`/g, '$1')       // Remove code markdown
      .replace(/#{1,6}\s/g, '')        // Remove headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/\n+/g, ' ')            // Replace newlines with spaces
      .trim();

    if (!cleanText) {
      return NextResponse.json({ error: 'No valid text to synthesize' }, { status: 400 });
    }

    // Check if Google Cloud credentials are configured
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const keyFilename = process.env.GOOGLE_CLOUD_KEY_FILE;
    const serviceAccountKey = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY;

    if (!projectId || (!keyFilename && !serviceAccountKey)) {
      console.log('Google Cloud TTS not configured, falling back to browser synthesis');
      return NextResponse.json({ 
        error: 'Google Cloud TTS not configured. Using browser fallback.' 
      }, { status: 503 });
    }

    // Initialize Google Cloud Text-to-Speech client
    let client: TextToSpeechClient;
    
    if (serviceAccountKey) {
      // Use service account key from environment variable
      const credentials = JSON.parse(serviceAccountKey);
      client = new TextToSpeechClient({
        projectId,
        credentials
      });
    } else if (keyFilename) {
      // Use key file path
      client = new TextToSpeechClient({
        projectId,
        keyFilename
      });
    } else {
      throw new Error('No valid Google Cloud credentials found');
    }

    // Configure the request for a high-quality WaveNet voice
    const ttsRequest = {
      input: { text: cleanText },
      voice: { 
        languageCode: 'en-US', 
        name: 'en-US-Wavenet-F', // High-quality WaveNet voice
        ssmlGender: 'FEMALE' as const
      },
      audioConfig: { 
        audioEncoding: 'MP3' as const,
        speakingRate: 1.0
      },
    };

    console.log('Synthesizing speech for text:', cleanText.substring(0, 50) + '...');
    
    // Call Google Cloud Text-to-Speech API
    const [response] = await client.synthesizeSpeech(ttsRequest);
    
    if (!response.audioContent) {
      throw new Error('No audio content received from Google Cloud TTS');
    }

    console.log('Speech synthesis successful, audio length:', response.audioContent.length);
    
    // Return the audio content as MP3
    return new NextResponse(response.audioContent, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Text-to-Speech API error:', error);
    
    // Return a more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json({ 
      error: 'Text-to-Speech service unavailable',
      details: errorMessage,
      fallback: 'Browser speech synthesis will be used instead'
    }, { status: 500 });
  }
} 