import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || (process.env as any).VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (process.env as any).VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  console.warn('Supabase URL is missing or using placeholder. Authenticated features will fail with "Failed to fetch".');
} else {
  console.log('Supabase client initialized with endpoint:', supabaseUrl.substring(0, 15) + '...');
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your .env file or Secrets panel.');
}

// Ensure the client only initializes if the URL is valid to prevent crashes
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

// Admin-specific client with a separate storage key to prevent session collision
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storageKey: 'sb-admin-auth-token',
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
