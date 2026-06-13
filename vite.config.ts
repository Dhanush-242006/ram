import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import dotenv from 'dotenv';

export default defineConfig(({mode}) => {
  // Load standard .env
  dotenv.config();
  // Fallback to .env.example
  try {
    dotenv.config({ path: path.resolve(process.cwd(), '.env.example') });
  } catch (e) {
    console.warn('Could not load .env.example', e);
  }

  const env = loadEnv(mode, '.', '');
  
  // Robustly resolve environment variables
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://iyenejgtvemodfjkqhvk.supabase.co';
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZW5lamd0dmVtb2RmamtxaHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjgwNjMsImV4cCI6MjA5MjYwNDA2M30.zuIgNtqAwTuhjOtAsGd_BKySdVjZD20yzU-ienlQQSs';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
