import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabaseAdmin } from './lib/supabase';

interface AdminAuthContextType {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active sessions
    supabaseAdmin.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Admin Session retrieval error:', error);
        if (error.message.includes('Refresh Token Not Found') || error.message.includes('Invalid Refresh Token')) {
          console.warn('Invalid admin refresh token detected, clearing local admin auth state...');
          supabaseAdmin.auth.signOut({ scope: 'local' });
        }
      }
      setUser(session?.user ?? null);
      setIsLoading(false);
    }).catch(err => {
      console.error('Unexpected admin auth error:', err);
      if (err.message?.includes('fetch')) {
        console.error('Network error during admin session retrieval.');
      }
      setIsLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange((event, session) => {
      console.log('Admin Auth event:', event);
      setUser(session?.user ?? null);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // 1. Forcefully and instantly clear the admin user state to trigger UI logout transition
    setUser(null);
    
    // 2. Clean up sb-admin-auth-token in localStorage immediately
    try {
      localStorage.removeItem('sb-admin-auth-token');
    } catch (storageErr) {
      console.error('Failed to clean admin localStorage:', storageErr);
    }

    // 3. Initiate local and global sign-out in the background without blocking the main thread
    try {
      await supabaseAdmin.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Local admin signOut failed:', err);
    }

    supabaseAdmin.auth.signOut().catch(err => {
      console.warn('Background admin global signOut failed (non-blocking):', err);
    });
  };

  return (
    <AdminAuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
