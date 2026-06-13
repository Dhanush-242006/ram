import { useState, useEffect } from 'react';
import { UserInputs, TravelPlan } from './types';
import { generateTravelPlan, modifyTravelPlan } from './services/gemini';
import TravelForm from './components/TravelForm';
import ItineraryDisplay from './components/ItineraryDisplay';
import LoginPage from './components/LoginPage';
import AdminLoginPage from './components/AdminLoginPage';
import AdminDashboard from './components/AdminDashboard';
import { AuthProvider, useAuth } from './AuthContext';
import { AdminAuthProvider, useAdminAuth } from './AdminAuthContext';
import { supabase } from './lib/supabase';
import { Compass, Sparkles, Globe2, Map, ArrowLeft, LogOut, User, ShieldAlert, ShieldCheck, History, CheckCircle2, ChevronDown, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ADMIN_EMAILS, getLatestUserPlanUpdate } from './services/requestService';

function TravelApp() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const [isAdminView, setIsAdminView] = useState(false);
  const [planHistory, setPlanHistory] = useState<TravelPlan[]>([]);
  const [planGeneratedAt, setPlanGeneratedAt] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [inputs, setInputs] = useState<UserInputs>({
    fromLocation: '',
    toLocation: '',
    startDate: new Date().toISOString().split('T')[0],
    days: 3,
    budget: '',
    locations: '',
    budgetCategory: 'Medium',
    travelType: 'Solo',
    travelAgentAssistance: false,
  });

  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const plan = planHistory[planHistory.length - 1] || null;

  const handlePlanVersionSelect = (index: number) => {
    const selectedPlan = planHistory[index];
    if (selectedPlan) {
      const newHistory = [...planHistory.slice(0, index + 1)];
      setPlanHistory(newHistory);
      setShowHistoryDropdown(false);
    }
  };

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  // Realtime subscription and Polling for plan updates (approved requests)
  useEffect(() => {
    if (!user || isAdminView || !plan) return;

    // 1. Realtime setup
    const channel = supabase
      .channel(`plan_updates_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'refinement_requests',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new.status === 'approved' && payload.new.result_plan) {
            const updateCreatedAt = new Date(payload.new.created_at).getTime();
            if (updateCreatedAt > planGeneratedAt) {
              console.log('Realtime Sync: Applying elite modifications...');
              const newPlan = payload.new.result_plan as TravelPlan;
              setPlanHistory(prev => [...prev, newPlan]);
              setPlanGeneratedAt(updateCreatedAt);
              setShowUpdateToast(true);
              setTimeout(() => setShowUpdateToast(false), 8000);
            } else {
              console.log('Realtime Sync: Ignoring old modification request.');
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Sync Channel Status:', status);
      });

    // 2. Polling Fallback (Reliability layer)
    const pollInterval = setInterval(async () => {
      try {
        const update = await getLatestUserPlanUpdate(user.id);
        if (update?.status === 'approved' && update?.result_plan) {
          const updateCreatedAt = new Date(update.created_at).getTime();
          
          if (updateCreatedAt > planGeneratedAt) {
            const fetchedPlanStr = JSON.stringify(update.result_plan);
            const currentPlanStr = JSON.stringify(plan);
            
            if (fetchedPlanStr !== currentPlanStr) {
              console.log('Polling Sync: Update detected and applied.');
              setPlanHistory(prev => [...prev, update.result_plan!]);
              setPlanGeneratedAt(updateCreatedAt);
              setShowUpdateToast(true);
              setTimeout(() => setShowUpdateToast(false), 8000);
            }
          }
        }
      } catch (err) {
        console.error('Sync check failed:', err);
      }
    }, 5000); // Check every 5 seconds for ultimate responsiveness

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [user?.id, isAdminView, plan, planGeneratedAt]);

  const handleGenerate = async (newInputs: UserInputs) => {
    setInputs(newInputs);
    setIsLoading(true);
    setError(null);
    setPlanHistory([]);
    try {
      const result = await generateTravelPlan(newInputs);
      setPlanHistory([result]);
      setPlanGeneratedAt(Date.now());
      // Scroll to results
      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.error(err);
      let errorMessage = 'Failed to generate your itinerary. Please try again.';
      
      if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'The AI is currently busy due to high demand (Rate Limit Exceeded). Please wait a moment and try again.';
      } else if (err?.status === 403 || err?.message?.includes('403') || err?.message?.includes('PERMISSION_DENIED')) {
        errorMessage = 'Permission denied. Please check if your Gemini API key is correctly configured in the settings.';
      } else if (err.message) {
        try {
          // Attempt to parse JSON error if it's a stringified object
          const parsed = JSON.parse(err.message);
          errorMessage = parsed.error?.message || err.message;
        } catch {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModify = async (instruction: string) => {
    if (!plan) return;
    setIsModifying(true);
    setError(null);
    try {
      const result = await modifyTravelPlan(plan, instruction);
      setPlanHistory(prev => [...prev, result]);
      setPlanGeneratedAt(Date.now());
    } catch (err: any) {
      console.error(err);
      let errorMessage = 'Failed to modify your itinerary. Please try again.';
      
      if (err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = 'The AI is currently busy (Rate Limit Exceeded). Please wait a moment.';
      } else if (err?.status === 403 || err?.message?.includes('403') || err?.message?.includes('PERMISSION_DENIED')) {
        errorMessage = 'Permission denied. Please check your Gemini API key configuration.';
      } else if (err.message) {
        try {
          const parsed = JSON.parse(err.message);
          errorMessage = parsed.error?.message || err.message;
        } catch {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsModifying(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (isAdminView && isAdmin) {
    return (
      <AdminDashboard 
        onBack={() => setIsAdminView(false)} 
        onPlanUpdate={(newPlan) => {
          setPlanHistory(prev => [...prev, newPlan]);
          setPlanGeneratedAt(Date.now());
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-primary text-text-main font-sans selection:bg-accent/30 flex flex-col relative overflow-hidden">
      {/* Background Layers */}
      <div className="atmosphere" />
      <div className="noise-overlay" />
      
      {/* Intelligence Updated Toast */}
      <AnimatePresence>
        {showUpdateToast && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-6"
          >
            <div className="glass-card p-6 border-accent/40 bg-accent/10 border shadow-2xl flex items-center gap-5">
              <div className="w-12 h-12 bg-accent shadow-lg shadow-accent/40 rounded-2xl flex items-center justify-center shrink-0">
                <ShieldCheck className="text-white w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Intelligence Refined</h4>
                <p className="text-[11px] text-text-muted font-bold uppercase tracking-widest leading-relaxed">
                  Your Master Plan has been optimized by the Elite Concierge.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 w-full z-50 py-3 px-[2.5%] flex justify-center pointer-events-none">
        <div className="w-full max-w-7xl glass-card px-6 py-3 flex flex-col md:flex-row justify-between items-center pointer-events-auto">
          <div className="flex items-center gap-4 mb-2 md:mb-0">
          <div className="w-10 h-10 bg-gradient-to-br from-accent to-[#4D8CFF] rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
            <Compass className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white display-font">RAMSETUU</h1>
            <div className="flex items-center gap-2 text-[9px] text-text-muted font-bold uppercase tracking-[0.2em]">
              <Sparkles className="w-2.5 h-2.5 text-accent-light" />
              Elite Travel Intelligence
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-8">
          {isAdmin && (
            <button
              onClick={() => setIsAdminView(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent/10 hover:bg-accent/20 text-accent-light text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-accent/20 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Admin Portal
            </button>
          )}
          {plan ? (
            <div className="flex items-center gap-6">
              <div className="flex gap-8 border-r border-white/10 pr-8">
                <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest">
                  Destination <b className="block text-xs text-white mt-1 font-bold">{plan.destination}</b>
                </div>
                <div className="text-[9px] text-text-muted uppercase font-bold tracking-widest hidden sm:block">
                  Duration <b className="block text-xs text-white mt-1 font-bold">{plan.itinerary.length} Days</b>
                </div>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/5"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-accent-light" /> : <Moon className="w-4 h-4 text-accent-light" />}
              </button>

              {planHistory.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent/10 hover:bg-accent/20 text-accent-light text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-accent/20"
                  >
                    <History className="w-3.5 h-3.5" />
                    History
                    <ChevronDown className={`w-3 h-3 transition-transform ${showHistoryDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {showHistoryDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full right-0 mt-2 w-56 glass-card border-white/10 shadow-2xl z-[70] overflow-hidden"
                      >
                        <div className="p-2 space-y-1">
                          {planHistory.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => handlePlanVersionSelect(idx)}
                              className={`w-full text-left px-4 py-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-between group ${
                                idx === planHistory.length - 1
                                  ? 'bg-accent/20 text-accent-light'
                                  : 'text-text-muted hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span>Version {idx + 1}</span>
                                <span className="text-[7px] opacity-40 mt-0.5">
                                  {idx === 0 ? 'Original Blueprint' : `Refinement ${idx}`}
                                </span>
                              </div>
                              {idx === planHistory.length - 1 && (
                                <CheckCircle2 className="w-3 h-3 text-accent" />
                              )}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <button
                onClick={() => setPlanHistory([])}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Reset Planner
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all border border-white/5"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-accent-light" /> : <Moon className="w-4 h-4 text-accent-light" />}
              </button>
              
              <div className="flex items-center gap-2 text-[10px] text-text-muted font-bold uppercase tracking-widest">
                <User className="w-3 h-3 text-accent-light" />
                {user.email}
              </div>
              <button
                onClick={signOut}
                className="group flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/20"
              >
                <LogOut className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

      <main className="flex-1 flex flex-col pt-4">
        {/* Hero Section - Only shown when no plan */}
        {!plan && !isLoading && (
          <section className="pt-8 pb-32 px-6 relative">
            {/* Scenic Backdrop */}
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-full h-screen opacity-20 pointer-events-none overflow-hidden blur-[100px] z-0">
               <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center" />
            </div>

            <div className="max-w-7xl mx-auto text-center space-y-12 relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/[0.03] text-accent-light text-[10px] font-black uppercase tracking-[0.4em] rounded-full border border-white/[0.08] backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  Bespoke Itinerary Engine
                </div>
              </motion.div>
              
              <div className="space-y-6">
                <motion.h1 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="text-6xl md:text-8xl lg:text-[8rem] xl:text-[9rem] font-black tracking-tighter text-white leading-[0.9] display-font"
                >
                  Plan your next <br />
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.5, delay: 0.8 }}
                    className="text-accent italic bg-clip-text text-transparent bg-gradient-to-r from-accent via-accent-light to-[#4D8CFF] inline-block pb-4"
                  >
                    perfect escape.
                  </motion.span>
                </motion.h1>
                
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1, delay: 0.4 }}
                  className="text-xl md:text-2xl text-text-muted max-w-4xl mx-auto leading-relaxed font-light tracking-tight"
                >
                  Unrivaled itineraries crafted with <span className="text-white font-medium">realistic logistics</span>, 
                  <br className="hidden md:block" /> curated stays, and professional intelligence.
                </motion.p>
              </div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="flex flex-wrap justify-center items-center gap-12 pt-8"
              >
                <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                  <Globe2 className="w-5 h-5 mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Global Intelligence</span>
                </div>
                <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                  <Map className="w-5 h-5 mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Logistical Precision</span>
                </div>
                <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                  <Sparkles className="w-5 h-5 mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">AI Authored</span>
                </div>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="mt-24 relative z-20"
            >
              <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 p-10 bg-accent/20 blur-[120px] w-[60%] h-[200px] z-[-1]" />
              <TravelForm 
                onSubmit={handleGenerate} 
                isLoading={isLoading} 
                initialInputs={inputs}
              />
            </motion.div>
          </section>
        )}

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {(isLoading || error || plan) && (
            <section id="results" className="flex-1 flex flex-col pt-12">
              {isLoading || isModifying ? (
                <div className="flex-1 flex flex-col items-center justify-center py-32 space-y-10">
                  <div className="relative">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-32 h-32 border-2 border-white/5 border-t-accent rounded-full" 
                    />
                    <Globe2 className="absolute inset-0 m-auto w-12 h-12 text-accent animate-pulse" />
                  </div>
                  <div className="text-center space-y-3">
                    <h3 className="text-3xl font-black tracking-tighter text-white display-font italic">
                      {isModifying ? 'Updating Your Legacy' : 'Crafting Bespoke Logic'}
                    </h3>
                    <p className="text-text-muted text-sm uppercase tracking-[0.3em] font-bold">
                      {isModifying ? 'Applying elite modifications...' : 'Validating global logistics and premium stays...'}
                    </p>
                  </div>
                </div>
              ) : null}

              {error && (
                <div className="max-w-md mx-auto my-20 p-8 bg-red-50 rounded-xl border border-red-100 text-center space-y-4">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                    <Map className="text-red-600 w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-red-900">System Error</h3>
                  <p className="text-red-700 text-sm">{error}</p>
                  <button 
                    onClick={() => setError(null)}
                    className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Retry Generation
                  </button>
                </div>
              )}

              {plan && !isLoading && !isModifying && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1"
                >
                  <ItineraryDisplay 
                    plan={plan} 
                    planHistory={planHistory}
                    onVersionSelect={handlePlanVersionSelect}
                    onBack={() => setPlanHistory([])} 
                    onModify={handleModify}
                  />
                </motion.div>
              )}
            </section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 flex flex-col md:flex-row justify-end items-center gap-6 relative z-10">
        {plan && (
          <div className="flex flex-col md:flex-row gap-8 items-center text-white">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">Local Total</span>
              <span className="font-sans font-bold text-white text-sm">{plan.totalCostSummary.localCurrency}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-accent uppercase tracking-widest mb-1">Estimated Total</span>
              <span className="font-sans font-black text-white text-2xl">{plan.totalCostSummary.inr}</span>
            </div>
            <button 
              onClick={() => window.print()}
              className="px-6 py-2 bg-white/5 border border-white/10 text-white text-[10px] font-black hover:bg-white/10 transition-all uppercase tracking-[0.3em] font-serif italic rounded-lg"
            >
              Export Anthology
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

function AdminApp() {
  const { user, isLoading, signOut } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AdminLoginPage />;
  }

  return (
    <div className="min-h-screen bg-primary">
      <AdminDashboard onBack={() => window.location.href = '/'} />
      <button 
        onClick={signOut}
        className="fixed top-6 right-6 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-500/20 z-[100]"
      >
        Admin Sign Out
      </button>
    </div>
  );
}

export default function App() {
  const isAdminPath = window.location.pathname === '/admin';

  return (
    <AuthProvider>
      <AdminAuthProvider>
        {isAdminPath ? <AdminApp /> : <TravelApp />}
      </AdminAuthProvider>
    </AuthProvider>
  );
}
