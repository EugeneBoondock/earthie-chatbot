import { type NextRequest, NextResponse } from "next/server"
import { registerUser } from "@/auth.config"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Register user
    const user = await registerUser(name, email, password)

    return NextResponse.json({ user }, { status: 201 })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: (error as Error).message || "Something went wrong" }, { status: 500 })
  }
}

