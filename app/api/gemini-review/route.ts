import { NextResponse } from 'next/server'
import { reviewCode, ReviewResult } from '@/lib/gemini_review'

export async function POST(request: Request) {
  try {
    console.log('[Gemini Review API] Processing review request')
    
    // Extract code from request
    const body = await request.json()
    const { code } = body
    
    if (!code || typeof code !== 'string') {
      console.error('[Gemini Review API] Invalid request - missing or invalid code')
      return NextResponse.json({ 
        error: 'Missing or invalid code in request',
        approved: false,
        comment: 'Invalid code submission',
        badge: 'Review Error',
        requiresHuman: true
      }, { status: 400 })
    }
    
    // Log code length for debugging
    console.log(`[Gemini Review API] Received code of length: ${code.length} characters`)
    
    // Call code review function
    console.log('[Gemini Review API] Sending to Gemini for review')
    const review: ReviewResult = await reviewCode(code)
    
    console.log('[Gemini Review API] Review completed:', JSON.stringify(review, null, 2))
    return NextResponse.json(review)
  } catch (err: any) {
    console.error('[Gemini Review API] Error:', err)
    console.error('[Gemini Review API] Error stack:', err.stack)
    
    // Return a structured error response
    return NextResponse.json({ 
      error: `Review process error: ${err.message}`,
      approved: false,
      comment: `Failed to complete review: ${err.message}`,
      badge: 'Review Error',
      requiresHuman: true
    }, { status: 500 })
  }
}
