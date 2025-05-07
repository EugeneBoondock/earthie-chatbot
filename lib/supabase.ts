// lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing. Check your .env.local file.');
}

// Use createBrowserClient for client-side Supabase instance
// This function is designed to handle cookies correctly in a browser environment
// and work seamlessly with createServerClient in middleware/Server Components.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

export type User = {
  id: string
  email: string
  created_at: string
  updated_at: string
}