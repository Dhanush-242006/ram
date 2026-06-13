import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Compass, Mail, Lock, LogIn, Sparkles, AlertCircle, Eye, EyeOff, X, ArrowDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const origin = window.location.origin;
      console.log('Initiating Google Login from origin:', origin);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
          skipBrowserRedirect: true
        }
      });
      
      if (error) {
        console.error('Supabase OAuth error:', error);
        throw error;
      }
      
      if (data?.url) {
        console.log('OAuth URL generated');
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.innerWidth - width) / 2;
        const top = window.screenY + (window.innerHeight - height) / 2;
        
        const popup = window.open(
          data.url,
          'google_auth_popup',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
          setError('Popup blocked! Please allow popups for this site.');
        }
      } else {
        throw new Error('No authentication URL returned from Supabase. check your Supabase configuration.');
      }
    } catch (err: any) {
      console.error('Google Login Error:', err);
      setError(err.message || 'Failed to initiate Google login');
    }
  };

  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const { accessToken, refreshToken } = event.data;
        if (accessToken && refreshToken) {
          try {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            if (sessionError) throw sessionError;
          } catch (err: any) {
            setError(err.message || 'Failed to complete login');
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const scrollToNext = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#1C1D21] relative selection:bg-accent/20 selection:text-white">
      {/* BACKGROUND GRAPHIC DETAILS */}
      <div className="noise-overlay opacity-[0.01]" />

      {/* FLOATING HEADER SECTION */}
      <header className="fixed top-0 left-0 w-full z-40 px-6 py-6 md:px-12 flex justify-between items-center pointer-events-none">
        <div className="text-white text-lg font-bold tracking-[0.25em] font-serif italic mix-blend-difference pointer-events-auto select-none">
          R • S
        </div>
        <div className="flex items-center gap-8 pointer-events-auto">
          <span className="hidden md:inline text-white/70 text-[9px] uppercase tracking-[0.3em] font-black mix-blend-difference">
            REST, ANYWHERE • GOES EVERYWHERE
          </span>
          <button
            onClick={() => {
              setIsSignUp(false);
              setIsAuthOpen(true);
            }}
            className="px-5 py-2 bg-[#1C1D21] text-[#FAF8F5] border border-white/10 hover:bg-[#C05C33] hover:text-white hover:border-transparent transition-all duration-300 text-[10px] font-black uppercase tracking-[0.16em] rounded-full shadow-xl cursor-pointer"
          >
            Access Portal
          </button>
        </div>
      </header>

      {/* HERO PAGE SCREEN 1 */}
      <section className="relative z-10 min-h-screen flex flex-col justify-between items-center text-white px-6 py-16 overflow-hidden">
        {/* Full-bleed Beach Background with zoom-in on hover */}
        <div className="absolute inset-0 w-full h-full z-0 group/hero overflow-hidden bg-black/40">
          <img
            src="https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=2200&h=1400&q=85"
            alt="Aerial view of clean beach shoreline with palms and wave foam"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover scale-100 group-hover/hero:scale-105 transition-transform duration-[8000ms] ease-out select-none animate-fade-in opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        </div>

        {/* Top spacer */}
        <div />

        {/* Center Editorial Title */}
        <div className="relative z-10 text-center max-w-4xl mx-auto flex flex-col items-center">
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 0.9, y: 0 }}
            transition={{ duration: 1.2, delay: 0.2 }}
            className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-black text-white/95 mb-4"
          >
            ✦ AN EDITORIAL JOURNAL OF JOURNEYS ✦
          </motion.p>
          
          <motion.h1
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-7xl md:text-[9.5rem] font-serif italic tracking-tighter text-white leading-none capitalize mb-6 select-none"
            style={{ filter: 'drop-shadow(0 15px 15px rgba(0,0,0,0.15))' }}
          >
            RAMSETUU
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.9, y: 0 }}
            transition={{ duration: 1.2, delay: 0.6 }}
            className="font-serif italic text-lg md:text-2xl text-white/90 leading-relaxed max-w-xl mx-auto mb-10 text-center"
          >
            the world, gently planned — <br />
            one wander at a time.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => scrollToNext('chapter-one')}
            className="px-8 py-4 bg-white text-black text-[11px] font-black uppercase tracking-[0.2em] rounded-full shadow-2xl hover:bg-neutral-100 transition-all cursor-pointer"
          >
            begin your journey →
          </motion.button>
        </div>

        {/* Bottom Scroll Hint */}
        <div 
          onClick={() => scrollToNext('chapter-one')}
          className="relative z-10 flex flex-col items-center gap-2 cursor-pointer opacity-75 hover:opacity-100 transition-opacity"
        >
          <span className="text-[9px] tracking-[0.3em] font-black uppercase">Scroll</span>
          <ArrowDown className="w-3.5 h-3.5 animate-bounce text-white" />
        </div>
      </section>

      {/* CHAPTER ONE: MOUNTAINS */}
      <section id="chapter-one" className="min-h-screen py-24 md:py-36 px-6 md:px-16 flex items-center justify-center bg-[#FAF8F5] border-b border-[#FAF8F5]">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          {/* Left Text */}
          <div className="lg:col-span-5 space-y-8 flex flex-col justify-center">
            <div>
              <p className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-black text-accent mb-4">
                ✦ CHAPTER ONE ✦
              </p>
              <h2 className="text-4xl md:text-6xl font-serif italic text-[#1C1D21] font-black tracking-tight leading-none">
                Where the mountains <br />
                hold their breath.
              </h2>
            </div>
            
            <p className="font-serif text-[#1C1D21]/80 leading-relaxed text-sm md:text-base max-w-md italic font-light">
              At first light the air is thinner, the silence wider. Pine smoke curls from a stone chimney somewhere below. Every step upward feels earned.
            </p>

            <div className="text-[9px] text-[#1C1D21]/50 uppercase font-black tracking-[0.3em] border-t border-[#1C1D21]/10 pt-6">
              ALPS • DOLOMITES • HIMALAYAS • ANDES
            </div>
          </div>

          {/* Right Image with Offset Frame and Hover Effect */}
          <div className="lg:col-span-7 flex justify-center lg:justify-end">
            <div className="relative group w-full max-w-lg cursor-pointer">
              {/* Backing Frame */}
              <div className="absolute inset-0 border border-[#1C1D21]/10 rounded-[2rem] translate-x-5 translate-y-5 transition-transform duration-700 group-hover:translate-x-2 group-hover:translate-y-2 pointer-events-none" />
              
              {/* Image Container */}
              <div className="overflow-hidden rounded-[2rem] relative shadow-xl bg-neutral-200">
                <img
                  src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&h=1200&q=85"
                  alt="Splendid view of mountains"
                  referrerPolicy="no-referrer"
                  className="w-full h-[28rem] md:h-[35rem] object-cover scale-100 group-hover:scale-105 transition-transform duration-[3000ms] ease-out select-none"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CHAPTER TWO: OCEAN */}
      <section id="chapter-two" className="relative z-10 min-h-screen py-24 md:py-36 flex items-center justify-center text-white px-6">
        {/* Background Full-bleed Image with hover transition */}
        <div className="absolute inset-0 w-full h-full z-0 group/ocean overflow-hidden bg-black/50">
          <img
            src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80"
            alt="Warm turquoise shore line"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover scale-100 group-hover/ocean:scale-105 transition-transform duration-[6000ms] ease-out select-none opacity-80"
          />
          <div className="absolute inset-0 bg-black/10" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8 flex flex-col items-center">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-black text-white/90">
            ✦ CHAPTER TWO ✦
          </p>
          <h2 className="text-4xl md:text-7xl font-serif italic text-white font-black tracking-tight leading-none mb-2">
            Where the ocean <br />
            remembers you.
          </h2>
          <p className="font-serif text-white/90 leading-relaxed text-sm md:text-lg max-w-xl italic font-light">
            "Soft turquoise warm against bare feet. Palms bending toward afternoon. The hush of salt and silver."
          </p>
          <div className="text-[9px] text-white/60 uppercase font-black tracking-[0.3em] pt-6 border-t border-white/10 w-48">
            BALI • MALDIVES • SEYCHELLES • SANTORINI
          </div>
        </div>
      </section>

      {/* CHAPTER THREE: GENTLY CURATED */}
      <section id="chapter-three" className="py-24 md:py-36 px-6 md:px-12 bg-[#FAF8F5] border-b border-[#FAF8F5]">
        <div className="max-w-7xl mx-auto text-center space-y-16">
          <div className="space-y-4">
            <p className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-black text-accent">
              ✦ CHAPTER THREE ✦
            </p>
            <h2 className="text-4xl md:text-6xl font-serif italic text-[#1C1D21] tracking-tight font-black leading-none">
              A world, gently <span className="text-[#C05C33]">curated.</span>
            </h2>
          </div>

          {/* Three columns responsive container */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Forests */}
            <div className="group space-y-6 flex flex-col justify-start cursor-pointer">
              <div className="overflow-hidden rounded-2xl relative shadow-lg bg-neutral-200">
                <span className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/90 text-black text-[8px] font-black uppercase tracking-[0.2em] rounded-full">
                  NO. 01
                </span>
                <img
                  src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&h=1000&q=85"
                  alt="Mist wood landscape"
                  referrerPolicy="no-referrer"
                  className="w-full h-[25rem] object-cover scale-100 group-hover:scale-105 transition-transform duration-[3000ms] ease-out select-none"
                />
              </div>
              <div className="text-left space-y-2">
                <h3 className="font-serif italic font-black text-2xl text-[#1C1D21]">Forests</h3>
                <p className="text-xs text-[#1C1D21]/75 leading-relaxed italic">Whispering canopies of moss & ancient wood</p>
              </div>
            </div>

            {/* Dunes */}
            <div className="group space-y-6 flex flex-col justify-start cursor-pointer">
              <div className="overflow-hidden rounded-2xl relative shadow-lg bg-neutral-200">
                <span className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/90 text-black text-[8px] font-black uppercase tracking-[0.2em] rounded-full">
                  NO. 02
                </span>
                <img
                  src="https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&h=1000&q=85"
                  alt="Endless Amber Ridges Desert"
                  referrerPolicy="no-referrer"
                  className="w-full h-[25rem] object-cover scale-100 group-hover:scale-105 transition-transform duration-[3000ms] ease-out select-none"
                />
              </div>
              <div className="text-left space-y-2">
                <h3 className="font-serif italic font-black text-2xl text-[#1C1D21]">Dunes</h3>
                <p className="text-xs text-[#1C1D21]/75 leading-relaxed italic">Endless amber ridges shaped by ancient wind</p>
              </div>
            </div>

            {/* Cities */}
            <div className="group space-y-6 flex flex-col justify-start cursor-pointer">
              <div className="overflow-hidden rounded-2xl relative shadow-lg bg-neutral-200">
                <span className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/90 text-black text-[8px] font-black uppercase tracking-[0.2em] rounded-full">
                  NO. 03
                </span>
                <img
                  src="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&h=1000&q=85"
                  alt="Eiffel Tower Street View"
                  referrerPolicy="no-referrer"
                  className="w-full h-[25rem] object-cover scale-100 group-hover:scale-105 transition-transform duration-[3000ms] ease-out select-none"
                />
              </div>
              <div className="text-left space-y-2">
                <h3 className="font-serif italic font-black text-2xl text-[#1C1D21]">Cities</h3>
                <p className="text-xs text-[#1C1D21]/75 leading-relaxed italic">Cobblestones, cafés, and lamp-lit evenings</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CHAPTER FOUR: SKY AND WATER */}
      <section id="chapter-four" className="min-h-screen py-24 md:py-36 px-6 md:px-16 flex items-center justify-center bg-[#FAF8F5] border-b border-[#FAF8F5]">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          {/* Left Image with Offset Frame and Hover Effect */}
          <div className="lg:col-span-7 flex justify-center lg:justify-start order-2 lg:order-1">
            <div className="relative group w-full max-w-lg cursor-pointer">
              {/* Backing Frame */}
              <div className="absolute inset-0 border border-[#1C1D21]/10 rounded-[2rem] -translate-x-5 translate-y-5 transition-transform duration-700 group-hover:-translate-x-2 group-hover:translate-y-2 pointer-events-none" />
              
              {/* Image Container */}
              <div className="overflow-hidden rounded-[2rem] relative shadow-xl bg-neutral-200">
                <img
                  src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&h=1200&q=85"
                  alt="Mountain reflecting in lake"
                  referrerPolicy="no-referrer"
                  className="w-full h-[28rem] md:h-[35rem] object-cover scale-100 group-hover:scale-105 transition-transform duration-[3000ms] ease-out select-none"
                />
              </div>
            </div>
          </div>

          {/* Right Text */}
          <div className="lg:col-span-5 space-y-8 flex flex-col justify-center order-1 lg:order-2">
            <div>
              <p className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-black text-accent mb-4">
                ✦ CHAPTER FOUR ✦
              </p>
              <h2 className="text-4xl md:text-6xl font-serif italic text-[#1C1D21] font-black tracking-tight leading-none">
                Where the sky <br />
                meets still water.
              </h2>
            </div>
            
            <p className="font-serif text-[#1C1D21]/80 leading-relaxed text-sm md:text-base max-w-md italic font-light">
              Lake basins like polished mirrors at dawn. The world reflecting upon itself. A morning that asks for nothing but your attention.
            </p>

            <div className="text-[9px] text-[#1C1D21]/50 uppercase font-black tracking-[0.3em] border-t border-[#1C1D21]/10 pt-6">
              LAKE COMO • BANFF • BLED • PICHOLA
            </div>
          </div>
        </div>
      </section>

      {/* THE FINAL PAGE (CALL TO ACTION) */}
      <section id="final-page" className="relative min-h-screen py-24 px-6 flex flex-col justify-between bg-[#FAF8F5] overflow-hidden">
        {/* Center watermark mark */}
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
          <span className="text-[25rem] md:text-[45rem] font-serif font-bold tracking-tight italic">R • S</span>
        </div>

        {/* Top spacer */}
        <div />

        {/* Center CTA block */}
        <div className="relative z-10 text-center space-y-8 max-w-3xl mx-auto my-12">
          <p className="text-[10px] md:text-xs uppercase tracking-[0.4em] font-black text-accent">
            ✦ THE FINAL PAGE ✦
          </p>
          <div className="space-y-2">
            <h2 className="text-5xl md:text-8xl font-serif italic font-black text-[#1C1D21] tracking-tight leading-none">
              Three minutes.
            </h2>
            <h2 className="text-4xl md:text-6xl font-serif italic font-black text-[#C05C33] tracking-tight leading-none">
              That is all it takes.
            </h2>
          </div>
          <p className="font-serif italic text-base md:text-xl text-[#1C1D21]/80 max-w-lg mx-auto leading-relaxed font-light">
            Tell us a place. We'll return with hotels, routes, days, and stories you can almost smell.
          </p>

          <div className="pt-6">
            <button
              onClick={() => {
                setIsSignUp(true);
                setIsAuthOpen(true);
              }}
              className="px-8 py-4.5 bg-[#1C1D21] text-[#FAF8F5] hover:bg-[#2C2D31] transition-all text-[11px] font-black uppercase tracking-[0.25em] rounded-full shadow-2xl inline-flex items-center gap-3 cursor-pointer"
            >
              plan your journey →
            </button>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#1C1D21]/40 mt-4">
              FREE • NO CREDIT CARD • INSTANT
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 text-center font-serif text-[10px] tracking-[0.3em] font-bold text-[#1C1D21]/50 uppercase">
          — RAMSETUU • MMXXVI —
        </footer>
      </section>

      {/* CENTERED AUTHENTICATION MODAL (POPUP OVERLAY) */}
      <AnimatePresence>
        {isAuthOpen && (
          <>
            {/* Backdrop slide blur fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 transition-opacity"
            />

            {/* Centered Grid Wrapper */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              {/* Centered Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', damping: 24, stiffness: 200 }}
                className="w-full max-w-md bg-[#0A0B10] border border-white/10 rounded-2xl md:rounded-[2rem] shadow-[0_30px_80px_rgba(0,0,0,0.9)] p-6 md:p-8 flex flex-col justify-between overflow-y-auto max-h-[90vh] pointer-events-auto"
              >
                {/* Header inside modal */}
                <div className="flex justify-between items-center pb-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <Compass className="text-accent w-5 h-5" />
                    <span className="text-white text-xs font-black tracking-widest uppercase">RAMSETUU PORTAL</span>
                  </div>
                  <button
                    onClick={() => setIsAuthOpen(false)}
                    className="p-1 px-2.5 text-text-muted hover:text-white transition-colors rounded-full hover:bg-white/5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Login form details */}
                <div className="py-4">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-serif text-white italic font-black tracking-tight leading-tight mb-2">
                      {isSignUp ? 'Create Legacy' : 'Secure Authorization'}
                    </h3>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-text-muted font-bold">
                      {isSignUp ? 'Join the Elite Travel Guild' : 'Enter Credentials for Workspace Access'}
                    </p>
                  </div>

                  <div className="flex bg-white/[0.03] p-1.5 rounded-2xl mb-6 border border-white/[0.05]">
                    <button
                      onClick={() => setIsSignUp(false)}
                      className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${!isSignUp ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => setIsSignUp(true)}
                      className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${isSignUp ? 'bg-accent text-white shadow-lg' : 'text-text-muted hover:text-white'}`}
                    >
                      Create Legacy
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3 text-red-400 text-xs font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Credential Identifier</label>
                      <div className="relative group">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                        <input
                          required
                          type="email"
                          placeholder="name@exclusive.com"
                          className="glass-input pl-14 font-medium"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em] ml-1">Secure Access Key</label>
                      <div className="relative group">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                        <input
                          required
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          className="glass-input pl-14 pr-12 font-medium"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      disabled={isLoading}
                      type="submit"
                      className="btn-premium w-full text-[10px] uppercase tracking-[0.25em] font-black py-4 shadow-xl shadow-accent/25 mt-2 cursor-pointer"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <LogIn className="w-3.5 h-3.5" />
                          {isSignUp ? 'Commence Registration' : 'Secure Authorization'}
                        </span>
                      )}
                    </button>
                  </form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/5"></div>
                    </div>
                    <div className="relative flex justify-center text-[8px] uppercase tracking-[0.3em] font-black text-text-muted">
                      <span className="bg-[#0A0B10] px-4">Federated Identity</span>
                    </div>
                  </div>

                  <button
                    onClick={handleGoogleLogin}
                    className="w-full py-3 bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.05] text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-3 shadow-md cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </button>
                </div>

                {/* Footer inside modal */}
                <div className="text-center text-[8px] text-text-muted uppercase font-bold tracking-[0.4em] pt-4 border-t border-white/5">
                  Curated by RAMSETUU Concierge
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
