
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jwmzjszdjlrqrhadbggr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bXpqc3pkamxycXJoYWRiZ2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NDA1MDAsImV4cCI6MjA1NjExNjUwMH0.PRCN-ynznky69N5pMYGALFZZpjj2OaFoPNbB7AvRaGc'

// Create Supabase client with proper persistence settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storage: localStorage
  }
})

// Helper function for more consistent user retrieval
export const getCurrentUser = async () => {
  const { data } = await supabase.auth.getSession();
  return { 
    user: data.session?.user || null,
    error: null
  };
}
