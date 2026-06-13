import React, { useState } from 'react';
import { supabaseAdmin } from '../lib/supabase';
import { ShieldAlert, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ADMIN_EMAILS } from '../services/requestService';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Basic admin email check before even trying
    if (!ADMIN_EMAILS.includes(email.toLowerCase())) {
      setError('Access Denied: You do not have administrative privileges.');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6 relative overflow-hidden">
      <div className="atmosphere" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-12">
          <div className="inline-flex p-4 rounded-3xl bg-accent/20 border border-accent/30 mb-6 shadow-2xl shadow-accent/20">
            <ShieldAlert className="w-10 h-10 text-accent-light" />
          </div>
          <h1 className="text-3xl font-black text-white uppercase tracking-[0.2em] mb-3">
            Elite Access
          </h1>
          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
            Guardian of Intelligent Itineraries
          </p>
        </div>

        <div className="glass-card p-10 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/50 to-accent/0" />
          
          <form onSubmit={handleLogin} className="space-y-8">
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-[10px] font-bold text-red-400 uppercase tracking-widest"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3 px-1">
                  Credential Identifier
                </label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 text-xs text-white focus:ring-1 focus:ring-accent outline-none transition-all placeholder:text-white/20 font-medium"
                    placeholder="name@elite.travel"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-3 px-1">
                  Secure Access Key
                </label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 text-xs text-white focus:ring-1 focus:ring-accent outline-none transition-all placeholder:text-white/20"
                    placeholder="••••••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-premium py-5 group shadow-xl shadow-accent/20"
            >
              <div className="flex items-center justify-center gap-3">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Verify & Authorize</span>
                  </>
                )}
              </div>
            </button>
          </form>

          <button 
            onClick={() => window.location.href = '/'}
            className="w-full mt-8 flex items-center justify-center gap-2 text-[10px] font-black text-text-muted hover:text-white uppercase tracking-widest transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to Public Terminal
          </button>
        </div>
      </motion.div>
    </div>
  );
}
