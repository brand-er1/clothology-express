
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jwmzjszdjlrqrhadbggr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bXpqc3pkamxycXJoYWRiZ2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NDA1MDAsImV4cCI6MjA1NjExNjUwMH0.PRCN-ynznky69N5pMYGALFZZpjj2OaFoPNbB7AvRaGc'

// Get the current host (works in both development and production)
const currentHost = window.location.origin

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Enable auto detection for handling hash fragments
    flowType: 'pkce', // Use PKCE flow for more secure auth
    redirectTo: `${currentHost}/auth/callback`, // Dynamic redirect based on current host
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
