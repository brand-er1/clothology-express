
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jwmzjszdjlrqrhadbggr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bXpqc3pkamxycXJoYWRiZ2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NDA1MDAsImV4cCI6MjA1NjExNjUwMH0.PRCN-ynznky69N5pMYGALFZZpjj2OaFoPNbB7AvRaGc'

// Support both development and production environments
const isProd = window.location.hostname === 'clothology-express.lovable.app'
const redirectUrl = isProd 
  ? 'https://clothology-express.lovable.app/auth/callback'
  : `${window.location.origin}/auth/callback`

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Enable auto detection for handling hash fragments
    flowType: 'pkce' // Use PKCE flow for more secure auth
  },
  global: {
    headers: {
      'x-application-name': 'brand-er-customize',
    },
  },
})

// Helper function for more consistent user retrieval
export const getCurrentUser = async () => {
  const { data } = await supabase.auth.getSession();
  return { 
    user: data.session?.user || null,
    error: null
  };
}

// Make the redirectUrl available for use in auth calls
export { redirectUrl }
