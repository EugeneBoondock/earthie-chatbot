// app/api/auth/register/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { registerUser } from "@/auth.config"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Call the correctly imported function
    const user = await registerUser(name, email, password)

    // It's often better to just return a success message or the non-sensitive parts
    // return NextResponse.json({ message: "User registered successfully", userId: user.id }, { status: 201 });
    // Or if you want to return the user object (ensure no sensitive data like password hash)
     return NextResponse.json({ user }, { status: 201 })

  } catch (error) {
    console.error("Registration error:", error)
    // Check if the error message is the one we threw ("User already exists")
    const message = (error instanceof Error) ? error.message : "Something went wrong";
    const status = message === "User already exists" ? 409 : 500; // 409 Conflict for existing user
    return NextResponse.json({ error: message }, { status: status })
  }
}