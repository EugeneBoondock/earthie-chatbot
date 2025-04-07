import NextAuth from "next-auth"
const { authOptions } = require("@/auth.config.js")

const handler = NextAuth(authOptions)

export const GET = handler
export const POST = handler

