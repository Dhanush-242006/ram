import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session retrieval error:', error);
        // If the refresh token is invalid/not found, clear local storage forcefully
        if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
          console.warn('Invalid refresh token detected, clearing local auth state...');
          supabase.auth.signOut({ scope: 'local' });
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    }).catch(err => {
      console.error('Unexpected auth error:', err);
      // Force clear on any unknown fatal error to prevent loops
      if (err.message?.includes('fetch')) {
        console.error('Network error during session retrieval. Check connectivity or Supabase URL.');
      }
      setIsLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // 1. Forcefully and instantly update React states to trigger immediate UI logout transition
    setUser(null);
    setSession(null);

    // 2. Clean up all supabase tokens in localStorage immediately
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.includes('supabase.auth.token') || key.includes('-auth-token')) {
          localStorage.removeItem(key);
        }
      }
    } catch (storageErr) {
      console.error('Failed to clean localStorage:', storageErr);
    }

    // 3. Initiate local and global sign-out in the background without blocking the main thread
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (localErr) {
      console.error('Background local signOut failed:', localErr);
    }

    supabase.auth.signOut().catch(err => {
      console.warn('Background global signOut failed (non-blocking):', err);
    });
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
