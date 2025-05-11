import { NextResponse } from 'next/server'
import { reviewCode, ReviewResult } from '@/lib/gemini_review'

export async function POST(request: Request) {
  try {
    const { code } = await request.json()
    const review: ReviewResult = await reviewCode(code)
    return NextResponse.json(review)
  } catch (err: any) {
    console.error('Gemini review error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
