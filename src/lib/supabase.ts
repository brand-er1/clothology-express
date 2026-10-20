
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jwmzjszdjlrqrhadbggr.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bXpqc3pkamxycXJoYWRiZ2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NDA1MDAsImV4cCI6MjA1NjExNjUwMH0.PRCN-ynznky69N5pMYGALFZZpjj2OaFoPNbB7AvRaGc'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper function for more consistent user retrieval
export const getCurrentUser = async () => {
  const { data } = await supabase.auth.getSession();
  return { 
    user: data.session?.user || null,
    error: null
  };
}
