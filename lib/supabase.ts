import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://iwdyfuglxfsbbrngxgye.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3ZHlmdWdseGZzYmJybmd4Z3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQzNzI1ODcsImV4cCI6MjA1OTk0ODU4N30.f0Ng3Ld9N_pyn-64bGPl7gjYZmE7-QyOFB1_ZyvzYrw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type User = {
  id: string
  email: string
  created_at: string
  updated_at: string
} 